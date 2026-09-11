import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  BitwardenClient,
  type BitwardenSecretItem,
  type BitwardenSecretStorage,
} from "./bitwarden.js";
import {
  getCollectionMapping,
  gsmPathFromBitwardenPath,
  validateSecretPath,
  type ReadableCollectionId,
} from "./config.js";
import { GsmClient } from "./gsm.js";
import { defaultLockDir, withSecretLock } from "./lock.js";
import { readSecretInput, type SecretInput } from "./secret-input.js";

export type MutationCommand = "create" | "update" | "delete";
export type MutationAction = "create" | "update" | "delete" | "skip";

export interface MutationBitwarden {
  findItem(
    collection: ReadableCollectionId,
    name: string,
  ): Promise<BitwardenSecretItem | undefined>;
  createItem(
    collection: ReadableCollectionId,
    name: string,
    value: string,
    storage: BitwardenSecretStorage,
  ): Promise<BitwardenSecretItem>;
  updateItem(
    item: BitwardenSecretItem,
    value: string,
    storage?: BitwardenSecretStorage,
  ): Promise<BitwardenSecretItem>;
  deleteItem(item: BitwardenSecretItem): Promise<void>;
}

export interface MutationGsm {
  wrapperSha256?: string;
  exists(collection: string, path: string): Promise<boolean>;
  create(
    collection: string,
    path: string,
    snapshotPath: string,
    timeoutMs: number,
  ): Promise<void>;
  update(
    collection: string,
    path: string,
    snapshotPath: string,
    timeoutMs: number,
  ): Promise<void>;
  delete(collection: string, path: string, timeoutMs: number): Promise<void>;
  ensureInteractive?: () => Promise<void>;
}

export interface MutationPlan {
  command: MutationCommand;
  collection: ReadableCollectionId;
  bitwardenPath: string;
  gsmPath: string;
  byteLength?: number;
  storage?: BitwardenSecretStorage;
  existingStorage?: BitwardenSecretStorage;
  bitwardenAction: MutationAction;
  gsmAction: MutationAction;
}

export interface ExecuteMutationOptions {
  command: MutationCommand;
  collection: string;
  bitwardenPath: string;
  fromFile?: string;
  fromStdin?: boolean;
  stdin?: Iterable<Buffer | string> | AsyncIterable<Buffer | string>;
  allowEmpty?: boolean;
  force?: boolean;
  dryRun?: boolean;
  gsmTimeoutMs?: number;
  lockDirectory?: string;
  readFile?: (path: string) => Promise<Buffer>;
  bitwarden?: MutationBitwarden;
  gsm?: MutationGsm;
}

export type MutationResult =
  | { state: "dry-run"; plan: MutationPlan }
  | { state: "applied"; plan: MutationPlan };

const DEFAULT_GSM_TIMEOUT_MS = 600_000;

export async function executeMutation(
  options: ExecuteMutationOptions,
): Promise<MutationResult> {
  validateSecretPath(options.bitwardenPath);
  const mapping = getCollectionMapping(options.collection);
  const gsmPath = gsmPathFromBitwardenPath(options.bitwardenPath);
  const timeoutMs = options.gsmTimeoutMs ?? DEFAULT_GSM_TIMEOUT_MS;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error("GSM timeout must be a positive integer in milliseconds");
  }
  if (options.command === "update" && options.force) {
    throw new Error("--force is not supported for update");
  }

  const bitwarden =
    options.bitwarden ?? new BitwardenClient({ env: process.env });
  const gsm = options.gsm ?? new GsmClient();
  const input =
    options.command === "delete"
      ? undefined
      : await readSecretInput({
          fromFile: options.fromFile,
          fromStdin: options.fromStdin,
          allowEmpty: options.allowEmpty,
          stdin: options.stdin,
          readFile: options.readFile,
        });

  return withSecretLock(
    `${options.collection}:${options.bitwardenPath}`,
    options.lockDirectory ?? defaultLockDir(),
    async () => {
      const existingBitwarden = await bitwarden.findItem(
        mapping.id,
        options.bitwardenPath,
      );
      const existingGsm = await gsm.exists(mapping.gsmCollection, gsmPath);
      const plan = createPlan({
        command: options.command,
        collection: mapping.id,
        bitwardenPath: options.bitwardenPath,
        gsmPath,
        input,
        existingBitwarden,
        existingGsm,
        force: options.force === true,
      });

      if (options.dryRun === true) return { state: "dry-run", plan };

      if (plan.gsmAction === "create") {
        await gsm.ensureInteractive?.();
      }
      const snapshot =
        input !== undefined &&
        (plan.gsmAction === "create" || plan.gsmAction === "update")
          ? await createSnapshot(input.value)
          : undefined;
      let bitwardenCompleted = false;
      try {
        await executeBitwardenAction(plan, existingBitwarden, input, bitwarden);
        bitwardenCompleted = plan.bitwardenAction !== "skip";
        await executeGsmAction(plan, snapshot, timeoutMs, gsm);
        return { state: "applied", plan };
      } catch (error) {
        throw mutationFailure(error, options.command, bitwardenCompleted);
      } finally {
        if (snapshot !== undefined) await removeSnapshot(snapshot);
      }
    },
  );
}

interface PlanInput {
  command: MutationCommand;
  collection: ReadableCollectionId;
  bitwardenPath: string;
  gsmPath: string;
  input?: SecretInput;
  existingBitwarden?: BitwardenSecretItem;
  existingGsm: boolean;
  force: boolean;
}

export function createPlan(input: PlanInput): MutationPlan {
  const hasBitwarden = input.existingBitwarden !== undefined;
  const hasGsm = input.existingGsm;
  let bitwardenAction: MutationAction;
  let gsmAction: MutationAction;

  if (input.command === "create") {
    if ((hasBitwarden || hasGsm) && !input.force) {
      throw new Error(
        "Secret already exists in one or both providers; retry with --force to reconcile it",
      );
    }
    bitwardenAction = hasBitwarden ? "update" : "create";
    gsmAction = hasGsm ? "update" : "create";
  } else if (input.command === "update") {
    if (!hasBitwarden || !hasGsm) {
      throw new Error(
        "Secret is absent from one or both providers; update requires both targets",
      );
    }
    bitwardenAction = "update";
    gsmAction = "update";
  } else {
    if ((!hasBitwarden || !hasGsm) && !input.force) {
      throw new Error(
        "Secret is absent from one or both providers; retry with --force to reconcile it",
      );
    }
    bitwardenAction = hasBitwarden ? "delete" : "skip";
    gsmAction = hasGsm ? "delete" : "skip";
  }

  return {
    command: input.command,
    collection: input.collection,
    bitwardenPath: input.bitwardenPath,
    gsmPath: input.gsmPath,
    ...(input.input === undefined
      ? {}
      : {
          byteLength: input.input.byteLength,
          storage: input.input.storage,
        }),
    ...(input.existingBitwarden === undefined
      ? {}
      : { existingStorage: input.existingBitwarden.storage }),
    bitwardenAction,
    gsmAction,
  };
}

async function executeBitwardenAction(
  plan: MutationPlan,
  existing: BitwardenSecretItem | undefined,
  input: SecretInput | undefined,
  bitwarden: MutationBitwarden,
): Promise<void> {
  if (plan.bitwardenAction === "skip") return;
  if (plan.bitwardenAction === "delete") {
    if (!existing)
      throw new Error("Bitwarden target disappeared before delete");
    await bitwarden.deleteItem(existing);
    return;
  }
  if (!input) throw new Error("Secret input is required for this operation");
  if (plan.bitwardenAction === "create") {
    await bitwarden.createItem(
      plan.collection,
      plan.bitwardenPath,
      input.value,
      input.storage,
    );
    return;
  }
  if (!existing) throw new Error("Bitwarden target disappeared before update");
  await bitwarden.updateItem(
    existing,
    input.value,
    plan.command === "create" ? input.storage : existing.storage,
  );
}

async function executeGsmAction(
  plan: MutationPlan,
  snapshot: { path: string } | undefined,
  timeoutMs: number,
  gsm: MutationGsm,
): Promise<void> {
  if (plan.gsmAction === "skip") return;
  if (plan.gsmAction === "delete") {
    await gsm.delete(plan.collection, plan.gsmPath, timeoutMs);
    return;
  }
  if (!snapshot) throw new Error("Secret snapshot is required for GSM update");
  if (plan.gsmAction === "create") {
    await gsm.create(plan.collection, plan.gsmPath, snapshot.path, timeoutMs);
  } else {
    await gsm.update(plan.collection, plan.gsmPath, snapshot.path, timeoutMs);
  }
}

function mutationFailure(
  error: unknown,
  command: MutationCommand,
  bitwardenCompleted: boolean,
): Error {
  const message =
    error instanceof Error ? error.message : "Secret operation failed";
  if (!bitwardenCompleted) {
    return new Error(`${message}; retry the ${command} command`, {
      cause: error,
    });
  }
  const force =
    command === "create" || command === "delete" ? " with --force" : "";
  return new Error(
    `${message}; Bitwarden was updated first, so retry the ${command} command${force}`,
    { cause: error },
  );
}

async function createSnapshot(value: string): Promise<{ path: string }> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "rhdh-e2e-secret-"));
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
  return { path: snapshotPath };
}

async function removeSnapshot(snapshot: { path: string }): Promise<void> {
  await rm(path.dirname(snapshot.path), { recursive: true, force: true }).catch(
    () => undefined,
  );
}
