import { randomUUID } from "node:crypto";
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  getCollectionMapping,
  gsmPathFromBitwardenPath,
  validateRotationPath,
  type ReadableCollectionId,
} from "./config.js";
import type { BitwardenRotationStorage } from "./bitwarden.js";

export type RotationState =
  | "bitwarden-pending"
  | "bitwarden-failed"
  | "gsm-failed"
  | "gsm-succeeded";

export type GsmStatus = "not-started" | "failed" | "succeeded";

export interface RotationJournal {
  version: 1;
  id: string;
  collection: ReadableCollectionId;
  bitwardenPath: string;
  gsmPath: string;
  itemId: string;
  itemName: string;
  storage: BitwardenRotationStorage;
  revisionDate: string;
  state: RotationState;
  gsmStatus: GsmStatus;
  wrapperSha256?: string;
  createdAt: string;
  updatedAt: string;
}

export type NewRotationJournal = Omit<
  RotationJournal,
  "version" | "id" | "createdAt" | "updatedAt"
>;

const ROTATION_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class JournalStore {
  constructor(private readonly rootDir: string = defaultStateDir()) {}

  get directory(): string {
    return this.rootDir;
  }

  async create(input: NewRotationJournal): Promise<RotationJournal> {
    assertSafeRecord(input);
    const now = new Date().toISOString();
    const record: RotationJournal = {
      ...input,
      version: 1,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    const validated = parseJournal(record, record.id);
    await this.write(validated);
    return validated;
  }

  async read(id: string): Promise<RotationJournal> {
    validateRotationId(id);
    const value = JSON.parse(
      await readFile(path.join(this.rootDir, `${id}.json`), "utf8"),
    ) as unknown;
    return parseJournal(value, id);
  }

  async update(
    id: string,
    patch: Partial<
      Pick<
        RotationJournal,
        "state" | "gsmStatus" | "revisionDate" | "wrapperSha256"
      >
    >,
  ): Promise<RotationJournal> {
    assertSafeRecord(patch);
    const current = await this.read(id);
    const updated = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    const validated = parseJournal(updated, id);
    await this.write(validated);
    return validated;
  }

  private async write(record: RotationJournal): Promise<void> {
    await mkdir(this.rootDir, { recursive: true, mode: 0o700 });
    await chmod(this.rootDir, 0o700);
    const destination = path.join(this.rootDir, `${record.id}.json`);
    const temporary = `${destination}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(record)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    await chmod(temporary, 0o600);
    await rename(temporary, destination);
    await chmod(destination, 0o600);
  }
}

export function validateRotationId(id: string): void {
  if (!ROTATION_ID.test(id)) {
    throw new Error("Invalid rotation ID");
  }
}

export function defaultStateDir(env: NodeJS.ProcessEnv = process.env): string {
  const configuredRoot = env.XDG_STATE_HOME;
  const stateRoot =
    configuredRoot && path.isAbsolute(configuredRoot)
      ? configuredRoot
      : path.join(os.homedir(), ".local", "state");
  return path.join(stateRoot, "rhdh-e2e-secrets", "rotations");
}

function assertSafeRecord(value: Record<string, unknown>): void {
  const forbidden = ["value", "secret", "payload", "stdin", "fromFile"];
  if (Object.keys(value).some((key) => forbidden.includes(key))) {
    throw new Error("Rotation journal cannot contain secret fields");
  }
  const allowed = new Set([
    "version",
    "id",
    "collection",
    "bitwardenPath",
    "gsmPath",
    "itemId",
    "itemName",
    "storage",
    "revisionDate",
    "state",
    "gsmStatus",
    "wrapperSha256",
    "createdAt",
    "updatedAt",
  ]);
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    throw new Error("Rotation journal contains unsupported fields");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJournal(value: unknown, id: string): RotationJournal {
  if (!isRecord(value) || value.version !== 1 || value.id !== id) {
    throw new Error(`Invalid rotation journal: ${id}`);
  }
  assertSafeRecord(value);
  const stringFields = [
    "collection",
    "bitwardenPath",
    "gsmPath",
    "itemId",
    "itemName",
    "revisionDate",
    "createdAt",
    "updatedAt",
  ] as const;
  if (stringFields.some((field) => typeof value[field] !== "string")) {
    throw new Error(`Invalid rotation journal: ${id}`);
  }
  const collection = value.collection as string;
  const bitwardenPath = value.bitwardenPath as string;
  const gsmPath = value.gsmPath as string;
  try {
    const mapping = getCollectionMapping(collection);
    validateRotationPath(bitwardenPath);
    if (gsmPathFromBitwardenPath(bitwardenPath) !== gsmPath) {
      throw new Error("GSM path does not match the Bitwarden path");
    }
    if (mapping.id !== collection) throw new Error("Invalid collection");
  } catch {
    throw new Error(`Invalid rotation journal: ${id}`);
  }
  if (
    (value.storage !== "note" && value.storage !== "attachment") ||
    ![
      "bitwarden-pending",
      "bitwarden-failed",
      "gsm-failed",
      "gsm-succeeded",
    ].includes(value.state as RotationState) ||
    !["not-started", "failed", "succeeded"].includes(
      value.gsmStatus as GsmStatus,
    ) ||
    (value.wrapperSha256 !== undefined &&
      typeof value.wrapperSha256 !== "string")
  ) {
    throw new Error(`Invalid rotation journal: ${id}`);
  }
  if (
    (value.state === "bitwarden-pending" &&
      value.gsmStatus !== "not-started") ||
    (value.state === "bitwarden-failed" && value.gsmStatus !== "not-started") ||
    (value.state === "gsm-succeeded" && value.gsmStatus !== "succeeded") ||
    (value.state === "gsm-failed" &&
      value.gsmStatus !== "not-started" &&
      value.gsmStatus !== "failed")
  ) {
    throw new Error(`Invalid rotation journal state: ${id}`);
  }
  return value as unknown as RotationJournal;
}
