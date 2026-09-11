import { createHash } from "node:crypto";
import {
  chmod,
  lstat,
  mkdir,
  readFile,
  rename,
  stat,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  runCommand,
  type CommandResult,
  type CommandRunner,
} from "./command.js";

const WRAPPER_URL =
  "https://raw.githubusercontent.com/openshift/release/main/hack/secret-manager.sh";
const WRAPPER_FILE = "secret-manager.sh";
const CACHE_METADATA_FILE = "secret-manager.json";
const DEFAULT_FETCH_TIMEOUT_MS = 60_000;

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

  constructor(options: GsmWrapperOptions = {}) {
    this.cacheDir =
      options.cacheDir ?? defaultCacheDir(options.env ?? process.env);
    this.fetchScript = options.fetchScript ?? fetchCurrentWrapper;
    this.fetchTimeoutMs = options.fetchTimeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
    this.commandRunner = options.commandRunner ?? runCommand;
    this.env = buildGsmEnvironment({ ...process.env, ...options.env });
    this.warning = options.warning ?? console.warn;
  }

  async run(
    args: readonly string[],
    timeoutMs?: number,
    stdio: "pipe" | "inherit" = "pipe",
  ): Promise<GsmWrapperRunResult> {
    const metadata = await this.ensureWrapper();
    const result = await this.commandRunner(
      "bash",
      [metadata.scriptPath, ...args],
      { env: this.env, timeoutMs, stdio },
    );
    return {
      ...result,
      usedCache: metadata.usedCache,
      sha256: metadata.sha256,
    };
  }

  async login(): Promise<GsmWrapperRunResult> {
    return this.run(["login"], undefined, "inherit");
  }

  async clean(): Promise<GsmWrapperRunResult> {
    return this.run(["clean"], undefined, "inherit");
  }

  private async ensureWrapper(): Promise<GsmWrapperMetadata> {
    if (this.activeMetadata) return this.activeMetadata;
    await mkdir(path.join(this.cacheDir, "gcp-secret-manager"), {
      recursive: true,
      mode: 0o700,
    });
    await chmod(this.cacheDir, 0o700);
    try {
      const script = await this.fetchScript(this.fetchTimeoutMs);
      validateWrapper(script);
      return (this.activeMetadata = await this.writeCache(script, false));
    } catch {
      const cached = await this.readCachedMetadata();
      if (!cached) {
        throw new Error(
          "Unable to download the GSM wrapper and no validated cache exists",
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
    const scriptPath = path.join(this.cacheDir, WRAPPER_FILE);
    const sha256 = hash(script);
    const fetchedAt = new Date().toISOString();
    const temporaryPath = `${scriptPath}.${process.pid}.tmp`;
    await writeFile(temporaryPath, script, { encoding: "utf8", mode: 0o700 });
    await chmod(temporaryPath, 0o700);
    await rename(temporaryPath, scriptPath);
    const metadata = { scriptPath, sha256, fetchedAt };
    const metadataPath = path.join(this.cacheDir, CACHE_METADATA_FILE);
    const temporaryMetadataPath = `${metadataPath}.${process.pid}.tmp`;
    await writeFile(temporaryMetadataPath, `${JSON.stringify(metadata)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    await chmod(temporaryMetadataPath, 0o600);
    await rename(temporaryMetadataPath, metadataPath);
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
      if (metadata.scriptPath !== path.join(this.cacheDir, WRAPPER_FILE)) {
        return undefined;
      }
      if ((await lstat(metadata.scriptPath)).isSymbolicLink()) return undefined;
      const script = await readFile(metadata.scriptPath, "utf8");
      validateWrapper(script);
      if (hash(script) !== metadata.sha256) return undefined;
      const details = await stat(metadata.scriptPath);
      if ((details.mode & 0o111) === 0) return undefined;
      return {
        scriptPath: metadata.scriptPath,
        sha256: metadata.sha256,
        fetchedAt: metadata.fetchedAt,
      };
    } catch {
      return undefined;
    }
  }
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
}

async function fetchCurrentWrapper(
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<string> {
  const response = await fetch(WRAPPER_URL, {
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`GitHub returned HTTP ${response.status}`);
  }
  return response.text();
}

function hash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function buildGsmEnvironment(parent: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
