import { GsmWrapper, type GsmWrapperRunResult } from "./gsm-wrapper.js";

export type GsmMetadata = Record<string, unknown>;

export class GsmNotFoundError extends Error {
  constructor(public readonly secretPath: string) {
    super(`GSM target does not exist: ${secretPath}`);
    this.name = "GsmNotFoundError";
  }
}

export interface GsmRunOptions {
  stdio?: "pipe" | "inherit";
  tty?: boolean;
}

export interface GsmRunner {
  run(
    args: readonly string[],
    timeoutMs?: number,
    options?: GsmRunOptions,
  ): Promise<GsmWrapperRunResult>;
  ensureInteractive?: () => Promise<void>;
}

export interface GsmClientOptions {
  runner?: GsmRunner;
  metadataTimeoutMs?: number;
}

export class GsmClient {
  private readonly runner: GsmRunner;
  private readonly metadataTimeoutMs: number;
  wrapperSha256?: string;

  constructor(options: GsmClientOptions = {}) {
    this.runner = options.runner ?? new GsmWrapper();
    this.metadataTimeoutMs = options.metadataTimeoutMs ?? 60_000;
    if (
      !Number.isSafeInteger(this.metadataTimeoutMs) ||
      this.metadataTimeoutMs <= 0
    ) {
      throw new Error(
        "GSM metadata timeout must be a positive integer in milliseconds",
      );
    }
  }

  async describe(collection: string, secretPath: string): Promise<GsmMetadata> {
    const result = await this.runner.run(
      ["describe", "-c", collection, secretPath, "-o", "json"],
      this.metadataTimeoutMs,
    );
    this.wrapperSha256 = result.sha256;
    if (result.timedOut) {
      throw new Error(`GSM metadata check timed out: ${secretPath}`);
    }
    if (result.status !== 0) {
      if (isNotFoundResult(result)) throw new GsmNotFoundError(secretPath);
      throw new Error(
        `GSM target does not exist or is inaccessible: ${secretPath}`,
      );
    }
    let value: unknown;
    try {
      value = JSON.parse(result.stdout);
    } catch {
      throw new Error(`GSM returned invalid metadata for ${secretPath}`);
    }
    if (!isRecord(value)) {
      throw new Error(`GSM returned invalid metadata for ${secretPath}`);
    }
    return value;
  }

  async exists(collection: string, secretPath: string): Promise<boolean> {
    try {
      await this.describe(collection, secretPath);
      return true;
    } catch (error) {
      if (error instanceof GsmNotFoundError) return false;
      throw error;
    }
  }

  async list(collection: string): Promise<string[]> {
    const result = await this.runner.run(
      ["list", "-c", collection, "-o", "json"],
      this.metadataTimeoutMs,
    );
    this.wrapperSha256 = result.sha256;
    if (result.timedOut) throw new Error("GSM list timed out");
    if (result.status !== 0) throw new Error("GSM list failed");
    let value: unknown;
    try {
      value = JSON.parse(result.stdout);
    } catch {
      throw new Error("GSM returned invalid list output");
    }
    if (
      !Array.isArray(value) ||
      value.some((entry) => typeof entry !== "string")
    ) {
      throw new Error("GSM returned invalid list output");
    }
    return value;
  }

  async ensureInteractive(): Promise<void> {
    await this.runner.ensureInteractive?.();
  }

  async create(
    collection: string,
    secretPath: string,
    snapshotPath: string,
    timeoutMs: number,
  ): Promise<void> {
    const result = await this.runner.run(
      ["create", "-c", collection, secretPath, "--from-file", snapshotPath],
      timeoutMs,
      { stdio: "inherit", tty: true },
    );
    this.wrapperSha256 = result.sha256;
    if (result.timedOut) {
      throw gsmMutationError(
        `GSM create is indeterminate after ${timeoutMs}ms: ${secretPath}`,
        true,
      );
    }
    if (result.status !== 0) {
      throw gsmMutationError(`GSM create failed: ${secretPath}`, false);
    }
  }

  async update(
    collection: string,
    secretPath: string,
    snapshotPath: string,
    timeoutMs: number,
  ): Promise<void> {
    const result = await this.runner.run(
      ["update", "-c", collection, secretPath, "--from-file", snapshotPath],
      timeoutMs,
    );
    this.wrapperSha256 = result.sha256;
    if (result.timedOut) {
      throw gsmUpdateError(
        `GSM update is indeterminate after ${timeoutMs}ms: ${secretPath}`,
        true,
      );
    }
    if (result.status !== 0) {
      throw gsmUpdateError(`GSM update failed: ${secretPath}`, false);
    }
  }

  async delete(
    collection: string,
    secretPath: string,
    timeoutMs: number,
  ): Promise<void> {
    const result = await this.runner.run(
      ["delete", "-c", collection, secretPath],
      timeoutMs,
    );
    this.wrapperSha256 = result.sha256;
    if (result.timedOut) {
      throw gsmMutationError(
        `GSM delete is indeterminate after ${timeoutMs}ms: ${secretPath}`,
        true,
      );
    }
    if (result.status !== 0) {
      throw gsmMutationError(`GSM delete failed: ${secretPath}`, false);
    }
  }
}

export function gsmUpdateError(message: string, indeterminate: boolean): Error {
  const error = new Error(message) as Error & { indeterminate: boolean };
  error.indeterminate = indeterminate;
  return error;
}

export function gsmMutationError(
  message: string,
  indeterminate: boolean,
): Error {
  const error = new Error(message) as Error & { indeterminate: boolean };
  error.indeterminate = indeterminate;
  return error;
}

function isNotFoundResult(result: GsmWrapperRunResult): boolean {
  return /(?:does not exist|doesn't exist|not found)/i.test(
    `${result.stdout}\n${result.stderr}`,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
