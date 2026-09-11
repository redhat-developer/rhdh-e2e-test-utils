import { GsmWrapper, type GsmWrapperRunResult } from "./gsm-wrapper.js";

export type GsmMetadata = Record<string, unknown>;

export interface GsmRunner {
  run(
    args: readonly string[],
    timeoutMs?: number,
  ): Promise<GsmWrapperRunResult>;
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
}

export function gsmUpdateError(message: string, indeterminate: boolean): Error {
  const error = new Error(message) as Error & { indeterminate: boolean };
  error.indeterminate = indeterminate;
  return error;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
