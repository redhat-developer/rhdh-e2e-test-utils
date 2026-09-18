import { createHash, randomUUID } from "node:crypto";
import {
  chmod,
  lstat,
  mkdir,
  readFile,
  rm,
  rename,
  stat,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  assertInteractiveTerminal,
  runCommand,
  type CommandResult,
  type CommandRunner,
} from "./command.js";
import type { GsmRunOptions } from "./gsm.js";

const WRAPPER_URL =
  "https://raw.githubusercontent.com/openshift/release/main/hack/secret-manager.sh";
const WRAPPER_FILE = "secret-manager.sh";
const CACHE_METADATA_FILE = "secret-manager.json";
const DEFAULT_FETCH_TIMEOUT_MS = 60_000;
const TRUSTED_IMAGE_PATTERN =
  /^quay\.io\/openshift\/ci-public(?::[A-Za-z0-9][A-Za-z0-9._-]*|@sha256:[a-f0-9]{64})$/;

export interface GsmWrapperOptions {
  cacheDir?: string;
  fetchScript?: (timeoutMs?: number) => Promise<string>;
  fetchTimeoutMs?: number;
  commandRunner?: CommandRunner;
  env?: NodeJS.ProcessEnv;
  warning?: (message: string) => void;
}

export interface GsmWrapperMetadata {
  scriptPath: string;
  sha256: string;
  fetchedAt: string;
  usedCache: boolean;
}

export interface GsmWrapperRunResult extends CommandResult {
  usedCache: boolean;
  sha256?: string;
}

export class GsmWrapper {
  private readonly cacheDir: string;
  private readonly fetchScript: (timeoutMs?: number) => Promise<string>;
  private readonly commandRunner: CommandRunner;
  private readonly env: NodeJS.ProcessEnv;
  private readonly warning: (message: string) => void;
  private readonly fetchTimeoutMs: number;
  private activeMetadata?: GsmWrapperMetadata;
  private initialization?: Promise<GsmWrapperMetadata>;

  constructor(options: GsmWrapperOptions = {}) {
    this.cacheDir = path.resolve(
      options.cacheDir ?? defaultCacheDir(options.env ?? process.env),
    );
    this.fetchScript = options.fetchScript ?? fetchCurrentWrapper;
    this.fetchTimeoutMs = options.fetchTimeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
    this.commandRunner = options.commandRunner ?? runCommand;
    this.env = buildGsmEnvironment({ ...process.env, ...options.env });
    this.warning = options.warning ?? console.warn;
  }

  async run(
    args: readonly string[],
    timeoutMs?: number,
    options: GsmRunOptions = {},
  ): Promise<GsmWrapperRunResult> {
    const metadata = await this.ensureWrapper();
    const result = await this.commandRunner(
      "bash",
      [metadata.scriptPath, ...args],
      {
        env: this.env,
        timeoutMs,
        stdio: options.stdio,
        tty: options.tty,
      },
    );
    return {
      ...result,
      usedCache: metadata.usedCache,
      sha256: metadata.sha256,
    };
  }

  async login(): Promise<GsmWrapperRunResult> {
    return this.run(["login"], undefined, { stdio: "inherit", tty: true });
  }

  async clean(): Promise<GsmWrapperRunResult> {
    await rm(
      path.join(this.cacheDir, "gcp-secret-manager", ".secret-manager-gcloud"),
      { recursive: true, force: true },
    );
    return {
      status: 0,
      stdout: "",
      stderr: "",
      usedCache: this.activeMetadata?.usedCache ?? false,
      ...(this.activeMetadata?.sha256
        ? { sha256: this.activeMetadata.sha256 }
        : {}),
    };
  }

  async ensureInteractive(): Promise<void> {
    await assertInteractiveTerminal();
  }

  private async ensureWrapper(): Promise<GsmWrapperMetadata> {
    if (this.activeMetadata) return this.activeMetadata;
    if (this.initialization) return this.initialization;
    this.initialization = this.initializeWrapper().catch((error) => {
      this.initialization = undefined;
      throw error;
    });
    return this.initialization;
  }

  private async initializeWrapper(): Promise<GsmWrapperMetadata> {
    await mkdir(path.join(this.cacheDir, "gcp-secret-manager"), {
      recursive: true,
      mode: 0o700,
    });
    await chmod(this.cacheDir, 0o700);
    try {
      const script = await this.fetchScript(this.fetchTimeoutMs);
      validateWrapper(script);
      return (this.activeMetadata = await this.writeCache(script, false));
    } catch (error) {
      const cached = await this.readCachedMetadata();
      if (!cached) {
        throw new Error(
          `Unable to download the GSM wrapper and no validated cache exists: ${
            error instanceof Error ? error.message : "untrusted wrapper"
          }`,
          { cause: error },
        );
      }
      this.warning(
        `Using cached GSM wrapper from ${cached.fetchedAt} because refresh failed`,
      );
      return (this.activeMetadata = { ...cached, usedCache: true });
    }
  }

  private async writeCache(
    script: string,
    usedCache: boolean,
  ): Promise<GsmWrapperMetadata> {
    const sha256 = hash(script);
    const scriptPath = path.join(this.cacheDir, `${WRAPPER_FILE}.${sha256}`);
    const fetchedAt = new Date().toISOString();
    const suffix = `${process.pid}.${randomUUID()}`;
    const temporaryPath = `${scriptPath}.${suffix}.tmp`;
    const metadataPath = path.join(this.cacheDir, CACHE_METADATA_FILE);
    const temporaryMetadataPath = `${metadataPath}.${suffix}.tmp`;
    try {
      await writeFile(temporaryPath, script, { encoding: "utf8", mode: 0o700 });
      await chmod(temporaryPath, 0o700);
      await rename(temporaryPath, scriptPath);
    } finally {
      await rm(temporaryPath, { force: true }).catch(() => undefined);
    }
    const metadata = { scriptPath, sha256, fetchedAt };
    try {
      await writeFile(temporaryMetadataPath, `${JSON.stringify(metadata)}\n`, {
        encoding: "utf8",
        mode: 0o600,
      });
      await chmod(temporaryMetadataPath, 0o600);
      await rename(temporaryMetadataPath, metadataPath);
    } finally {
      await rm(temporaryMetadataPath, { force: true }).catch(() => undefined);
    }
    return { ...metadata, usedCache };
  }

  private async readCachedMetadata(): Promise<
    Omit<GsmWrapperMetadata, "usedCache"> | undefined
  > {
    try {
      const metadata = JSON.parse(
        await readFile(path.join(this.cacheDir, CACHE_METADATA_FILE), "utf8"),
      ) as unknown;
      if (!isRecord(metadata)) return undefined;
      if (
        typeof metadata.scriptPath !== "string" ||
        typeof metadata.sha256 !== "string" ||
        typeof metadata.fetchedAt !== "string"
      ) {
        return undefined;
      }
      const scriptPath = path.resolve(metadata.scriptPath);
      if (!isCacheScriptPath(this.cacheDir, scriptPath)) {
        return undefined;
      }
      if ((await lstat(scriptPath)).isSymbolicLink()) return undefined;
      const script = await readFile(scriptPath, "utf8");
      validateWrapper(script);
      if (hash(script) !== metadata.sha256) return undefined;
      const details = await stat(scriptPath);
      if ((details.mode & 0o111) === 0) return undefined;
      return {
        scriptPath,
        sha256: metadata.sha256,
        fetchedAt: metadata.fetchedAt,
      };
    } catch {
      return undefined;
    }
  }
}

function isCacheScriptPath(cacheDir: string, scriptPath: string): boolean {
  const relative = path.relative(
    path.resolve(cacheDir),
    path.resolve(scriptPath),
  );
  if (relative.startsWith("..") || path.isAbsolute(relative)) return false;
  const baseName = path.basename(scriptPath);
  return (
    baseName === WRAPPER_FILE ||
    new RegExp(`^${WRAPPER_FILE.replace(".", "\\.")}\\.[a-f0-9]{64}$`).test(
      baseName,
    )
  );
}

export function defaultCacheDir(env: NodeJS.ProcessEnv = process.env): string {
  const configuredRoot = env.XDG_CACHE_HOME;
  const cacheRoot =
    configuredRoot && path.isAbsolute(configuredRoot)
      ? configuredRoot
      : path.join(os.homedir(), ".cache");
  return path.join(cacheRoot, "rhdh-e2e-secrets", "gsm");
}

export function validateWrapper(script: string): void {
  if (
    !script.startsWith("#!/bin/bash") ||
    !script.includes("set -euo pipefail") ||
    !script.includes("GCLOUD_CONFIG_PATH") ||
    !script.includes("CONTAINER_ENGINE")
  ) {
    throw new Error("GSM wrapper validation failed");
  }
  const image = script.match(
    /^IMAGE="\$\{SECRET_MANAGER_IMAGE:-([^}]+)\}"$/m,
  )?.[1];
  if (!image || !TRUSTED_IMAGE_PATTERN.test(image)) {
    throw new Error("GSM wrapper validation failed: trusted image is required");
  }
}

async function fetchCurrentWrapper(
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<string> {
  const response = await fetch(WRAPPER_URL, {
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (response.url !== WRAPPER_URL) {
    throw new Error("GSM wrapper download redirected to an unexpected URL");
  }
  if (!response.ok) {
    throw new Error(`GitHub returned HTTP ${response.status}`);
  }
  return response.text();
}

function hash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function buildGsmEnvironment(parent: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  if (parent.SECRET_MANAGER_IMAGE !== undefined) {
    validateImageReference(parent.SECRET_MANAGER_IMAGE);
  }
  const allowed = new Set([
    "PATH",
    "HOME",
    "USER",
    "LOGNAME",
    "SHELL",
    "TMPDIR",
    "XDG_RUNTIME_DIR",
    "XDG_CONFIG_HOME",
    "CONTAINER_ENGINE",
    "CONTAINER_HOST",
    "DOCKER_HOST",
    "SECRET_MANAGER_IMAGE",
    "REGISTRY_AUTH_FILE",
    "CONTAINERS_AUTH_FILE",
    "SSL_CERT_FILE",
    "NO_COLOR",
    "TERM",
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "NO_PROXY",
  ]);
  const result: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(parent)) {
    if (value !== undefined && allowed.has(key.toUpperCase())) {
      result[key] = value;
    }
  }
  return result;
}

function validateImageReference(image: string): void {
  if (!TRUSTED_IMAGE_PATTERN.test(image)) {
    throw new Error(
      "SECRET_MANAGER_IMAGE must reference the trusted image repository quay.io/openshift/ci-public",
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
