import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { BitwardenClient, type BitwardenRotationItem } from "./bitwarden.js";
import {
  getCollectionMapping,
  gsmPathFromBitwardenPath,
  validateRotationPath,
  type ReadableCollectionId,
} from "./config.js";
import { GsmClient } from "./gsm.js";
import { JournalStore, type RotationJournal } from "./journal.js";
import { withRotationLock } from "./lock.js";
import { readRotationInput } from "./rotation-input.js";

export interface RotationBitwarden {
  readRotationItem(
    collection: ReadableCollectionId,
    name: string,
  ): Promise<BitwardenRotationItem>;
  updateRotationItem(
    item: BitwardenRotationItem,
    value: string,
  ): Promise<BitwardenRotationItem>;
}

export interface RotationGsm {
  wrapperSha256?: string;
  describe(collection: string, path: string): Promise<Record<string, unknown>>;
  update(
    collection: string,
    path: string,
    snapshotPath: string,
    timeoutMs: number,
  ): Promise<void>;
}

export interface ExecuteRotationOptions {
  collection?: string;
  bitwardenPath?: string;
  fromFile?: string;
  fromStdin?: boolean;
  stdin?: Iterable<Buffer | string> | AsyncIterable<Buffer | string>;
  allowEmpty?: boolean;
  apply: boolean;
  resumeId?: string;
  gsmTimeoutMs?: number;
  journal?: JournalStore;
  bitwarden?: RotationBitwarden;
  gsm?: RotationGsm;
}

export type RotationResult =
  | {
      state: "dry-run";
      byteLength: number;
      storage: BitwardenRotationItem["storage"];
      gsmPath: string;
    }
  | {
      state: "gsm-succeeded";
      operationId: string;
      gsmPath: string;
    };

export interface ResumableRotationError extends Error {
  operationId: string;
}

const DEFAULT_GSM_TIMEOUT_MS = 600_000;

export async function executeRotation(
  options: ExecuteRotationOptions,
): Promise<RotationResult> {
  const journal = options.journal ?? new JournalStore();
  const bitwarden =
    options.bitwarden ?? new BitwardenClient({ env: process.env });
  const gsm = options.gsm ?? new GsmClient();
  const timeoutMs = options.gsmTimeoutMs ?? DEFAULT_GSM_TIMEOUT_MS;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error("GSM timeout must be a positive integer in milliseconds");
  }

  if (options.resumeId !== undefined) {
    if (!options.apply) throw new Error("--resume requires --apply");
    return resumeRotation(options.resumeId, journal, bitwarden, gsm, timeoutMs);
  }
  if (!options.collection || !options.bitwardenPath) {
    throw new Error("--collection and --path are required");
  }
  validateRotationPath(options.bitwardenPath);
  const mapping = getCollectionMapping(options.collection);
  const collectionId = mapping.id;
  const gsmPath = gsmPathFromBitwardenPath(options.bitwardenPath);

  return withRotationLock(
    `${options.collection}:${options.bitwardenPath}`,
    journal.directory,
    async () => {
      const input = await readRotationInput({
        fromFile: options.fromFile,
        fromStdin: options.fromStdin,
        allowEmpty: options.allowEmpty,
        stdin: options.stdin,
      });
      const item = await bitwarden.readRotationItem(
        collectionId,
        options.bitwardenPath!,
      );
      await gsm.describe(mapping.gsmCollection, gsmPath);

      if (!options.apply) {
        return {
          state: "dry-run",
          byteLength: input.byteLength,
          storage: item.storage,
          gsmPath,
        };
      }

      const journalRecord = await journal.create({
        collection: collectionId,
        bitwardenPath: options.bitwardenPath!,
        gsmPath,
        itemId: item.id,
        itemName: item.name,
        storage: item.storage,
        revisionDate: item.revisionDate,
        state: "bitwarden-pending",
        gsmStatus: "not-started",
        ...(gsm.wrapperSha256 === undefined
          ? {}
          : { wrapperSha256: gsm.wrapperSha256 }),
      });
      const snapshot = await createSnapshot(input.value);
      try {
        let verified = item;
        try {
          verified = await bitwarden.updateRotationItem(item, input.value);
          if (verified.value !== input.value) {
            throw new Error(
              `Bitwarden read-back verification failed: ${item.name}`,
            );
          }
        } catch (error) {
          await journal.update(journalRecord.id, { state: "bitwarden-failed" });
          throw error;
        }

        await journal.update(journalRecord.id, {
          state: "gsm-failed",
          gsmStatus: "not-started",
          revisionDate: verified.revisionDate,
        });
        try {
          await gsm.update(
            mapping.gsmCollection,
            gsmPath,
            snapshot.path,
            timeoutMs,
          );
        } catch (error) {
          await markGsmFailure(journal, journalRecord.id, gsm);
          throw resumableError(error, journalRecord.id);
        }
        await journal.update(journalRecord.id, {
          state: "gsm-succeeded",
          gsmStatus: "succeeded",
          ...(gsm.wrapperSha256 === undefined
            ? {}
            : { wrapperSha256: gsm.wrapperSha256 }),
        });
        return {
          state: "gsm-succeeded",
          operationId: journalRecord.id,
          gsmPath,
        };
      } finally {
        await removeSnapshot(snapshot);
      }
    },
  );
}

async function resumeRotation(
  operationId: string,
  journal: JournalStore,
  bitwarden: RotationBitwarden,
  gsm: RotationGsm,
  timeoutMs: number,
): Promise<RotationResult> {
  return withRotationLock(
    `resume:${operationId}`,
    journal.directory,
    async () => {
      const record = await journal.read(operationId);
      if (record.state !== "gsm-failed") {
        throw new Error(`Rotation ${operationId} is not eligible for resume`);
      }
      const mapping = getCollectionMapping(record.collection);
      return withRotationLock(
        `${record.collection}:${record.bitwardenPath}`,
        journal.directory,
        async () => {
          const item = await bitwarden.readRotationItem(
            record.collection,
            record.bitwardenPath,
          );
          if (
            item.id !== record.itemId ||
            item.name !== record.itemName ||
            item.storage !== record.storage ||
            item.revisionDate !== record.revisionDate
          ) {
            throw new Error("Bitwarden revision changed; start a new rotation");
          }
          await gsm.describe(mapping.gsmCollection, record.gsmPath);
          const snapshot = await createSnapshot(item.value);
          try {
            try {
              await gsm.update(
                mapping.gsmCollection,
                record.gsmPath,
                snapshot.path,
                timeoutMs,
              );
            } catch (error) {
              await markGsmFailure(journal, operationId, gsm);
              throw resumableError(error, operationId);
            }
            await journal.update(operationId, {
              state: "gsm-succeeded",
              gsmStatus: "succeeded",
            });
          } finally {
            await removeSnapshot(snapshot);
          }
          return {
            state: "gsm-succeeded",
            operationId,
            gsmPath: record.gsmPath,
          };
        },
      );
    },
  );
}

async function createSnapshot(value: string): Promise<{
  path: string;
  remove: () => Promise<void>;
}> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "rhdh-e2e-rotation-"));
  const snapshotPath = path.join(directory, "value");
  try {
    await writeFile(snapshotPath, value, { encoding: "utf8", mode: 0o600 });
    await chmod(snapshotPath, 0o600);
  } catch (error) {
    await rm(directory, { recursive: true, force: true }).catch(
      () => undefined,
    );
    throw error;
  }
  return {
    path: snapshotPath,
    remove: () => rm(directory, { recursive: true, force: true }),
  };
}

async function removeSnapshot(snapshot: {
  remove: () => Promise<void>;
}): Promise<void> {
  try {
    await snapshot.remove();
  } catch {
    console.warn("Secret snapshot cleanup failed");
  }
}

async function markGsmFailure(
  journal: JournalStore,
  operationId: string,
  gsm: RotationGsm,
): Promise<void> {
  try {
    await journal.update(operationId, {
      state: "gsm-failed",
      gsmStatus: "failed",
      ...(gsm.wrapperSha256 === undefined
        ? {}
        : { wrapperSha256: gsm.wrapperSha256 }),
    });
  } catch {
    console.warn("Unable to update the rotation journal after GSM failure");
  }
}

export function isResumableRotation(record: RotationJournal): boolean {
  return record.state === "gsm-failed";
}

function resumableError(
  error: unknown,
  operationId: string,
): ResumableRotationError {
  const message = error instanceof Error ? error.message : "GSM update failed";
  const wrapped = new Error(message, {
    cause: error instanceof Error ? error : undefined,
  }) as ResumableRotationError;
  wrapped.operationId = operationId;
  return wrapped;
}
