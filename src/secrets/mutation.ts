import {
  BitwardenClient,
  type BitwardenSecretItem,
  type BitwardenSecretStorage,
} from "./bitwarden.js";
import {
  bitwardenPathFromGsmPath,
  getCollectionMapping,
  gsmPathFromBitwardenPath,
  type ReadableCollectionId,
} from "./config.js";
import { GsmClient } from "./gsm.js";
import { MAX_TIMEOUT_MS } from "./command.js";
import { defaultLockDir, withSecretLock } from "./lock.js";
import { readSecretInput, type SecretInput } from "./secret-input.js";
import {
  createTemporarySecretFile,
  type TemporarySecretFile,
} from "./temporary-secret.js";

export type MutationCommand = "create" | "update" | "delete";
export type MutationAction = "create" | "update" | "delete" | "skip";
type BitwardenMutationState = "not-started" | "attempted" | "confirmed";

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
  bitwardenCollection: string;
  gsmCollection: string;
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
  const bitwardenPath = bitwardenPathFromGsmPath(options.bitwardenPath);
  const mapping = getCollectionMapping(options.collection);
  const gsmPath = gsmPathFromBitwardenPath(bitwardenPath);
  const timeoutMs = options.gsmTimeoutMs ?? DEFAULT_GSM_TIMEOUT_MS;
  if (
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs <= 0 ||
    timeoutMs > MAX_TIMEOUT_MS
  ) {
    throw new Error(
      `GSM timeout must be a positive integer no greater than ${MAX_TIMEOUT_MS}ms`,
    );
  }
  if (options.command === "update" && options.force) {
    throw new Error("--force is not supported for update");
  }
  if (
    options.command === "delete" &&
    (options.fromFile !== undefined ||
      options.fromStdin === true ||
      options.allowEmpty === true)
  ) {
    throw new Error("delete does not accept input options");
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
    `${mapping.id}:${gsmPath}`,
    options.lockDirectory ?? defaultLockDir(),
    async () => {
      const [existingBitwarden, existingGsm] = await Promise.all([
        bitwarden.findItem(mapping.id, bitwardenPath),
        gsm.exists(mapping.gsmCollection, gsmPath),
      ]);
      const plan = createPlan({
        command: options.command,
        collection: mapping.id,
        bitwardenCollection: mapping.bitwardenCollection,
        gsmCollection: mapping.gsmCollection,
        bitwardenPath,
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
      let bitwardenState: BitwardenMutationState = "not-started";
      let operationError: unknown;
      try {
        if (plan.bitwardenAction !== "skip") {
          bitwardenState = "attempted";
          await executeBitwardenAction(
            plan,
            existingBitwarden,
            input,
            bitwarden,
          );
          bitwardenState = "confirmed";
        }
        await executeGsmAction(plan, snapshot, timeoutMs, gsm);
      } catch (error) {
        operationError = error;
      }

      let cleanupError: unknown;
      if (snapshot !== undefined) {
        try {
          await removeSnapshot(snapshot);
        } catch (error) {
          cleanupError = error;
        }
      }

      if (operationError !== undefined) {
        const failure = mutationFailure(
          operationError,
          options.command,
          bitwardenState,
          options.force === true,
        );
        if (cleanupError !== undefined) {
          throw new Error(
            `${failure.message}; temporary secret cleanup failed`,
            {
              cause: new AggregateError([failure, cleanupError]),
            },
          );
        }
        throw failure;
      }
      if (cleanupError !== undefined) {
        throw new Error(
          "Secret operation may have succeeded but temporary secret cleanup failed; inspect providers before retrying",
          { cause: cleanupError },
        );
      }
      return { state: "applied", plan };
    },
  );
}

interface PlanInput {
  command: MutationCommand;
  collection: ReadableCollectionId;
  bitwardenCollection: string;
  gsmCollection: string;
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
    bitwardenCollection: input.bitwardenCollection,
    gsmCollection: input.gsmCollection,
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
    await gsm.delete(plan.gsmCollection, plan.gsmPath, timeoutMs);
    return;
  }
  if (!snapshot) throw new Error("Secret snapshot is required for GSM update");
  if (plan.gsmAction === "create") {
    await gsm.create(
      plan.gsmCollection,
      plan.gsmPath,
      snapshot.path,
      timeoutMs,
    );
  } else {
    await gsm.update(
      plan.gsmCollection,
      plan.gsmPath,
      snapshot.path,
      timeoutMs,
    );
  }
}

function mutationFailure(
  error: unknown,
  command: MutationCommand,
  bitwardenState: BitwardenMutationState,
  forceRequested: boolean,
): Error {
  const message =
    error instanceof Error ? error.message : "Secret operation failed";
  const requiresForce =
    command === "create" || command === "delete"
      ? forceRequested || bitwardenState !== "not-started"
      : false;
  const force = requiresForce ? " with --force" : "";
  const retry = `retry the ${command} command${force}`;
  const bitwardenMessage =
    bitwardenState === "confirmed"
      ? `Bitwarden was updated first, so ${retry}`
      : bitwardenState === "attempted"
        ? `Bitwarden may have been updated, so ${retry}`
        : retry;
  const indeterminate =
    isIndeterminateError(error) &&
    "; GSM operation may be indeterminate; inspect GSM before retrying";
  return new Error(`${message}; ${bitwardenMessage}${indeterminate}`, {
    cause: error,
  });
}

async function createSnapshot(value: string): Promise<TemporarySecretFile> {
  return createTemporarySecretFile(value, "value");
}

async function removeSnapshot(snapshot: TemporarySecretFile): Promise<void> {
  await snapshot.remove();
}

function isIndeterminateError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error as Error & { indeterminate?: unknown }).indeterminate === true
  );
}
