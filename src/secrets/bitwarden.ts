import { runCommand, type CommandResult } from "./command.js";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  getCollectionMapping,
  type ExpandedSecretSelector,
  type ReadableCollectionId,
} from "./config.js";

export interface BitwardenCommandRunner {
  (
    command: string,
    args: readonly string[],
    options?: {
      env?: NodeJS.ProcessEnv;
      input?: string;
    },
  ): Promise<CommandResult>;
}

export interface BitwardenSecret {
  id: string;
  name: string;
  value: string;
  selector: ExpandedSecretSelector;
}

export interface BitwardenAttachment {
  id: string;
  fileName: string;
}

export type BitwardenSecretStorage = "note" | "attachment";

export interface BitwardenSecretItem {
  id: string;
  name: string;
  value: string;
  storage: BitwardenSecretStorage;
  revisionDate: string;
  raw: Record<string, unknown>;
  attachments: readonly BitwardenAttachment[];
  attachment?: BitwardenAttachment;
}

interface BitwardenCollection {
  id: string;
  name: string;
  organizationId: string;
}

export interface BitwardenClientOptions {
  command?: string;
  env?: NodeJS.ProcessEnv;
  runner?: BitwardenCommandRunner;
  removeTemporaryDirectory?: (directory: string) => Promise<void>;
}

export class BitwardenClient {
  private readonly command: string;
  private readonly env: NodeJS.ProcessEnv;
  private readonly runner: BitwardenCommandRunner;
  private readonly removeTemporaryDirectory: (
    directory: string,
  ) => Promise<void>;
  private sessionCheck?: Promise<void>;
  private readonly collections = new Map<
    string,
    Promise<BitwardenCollection>
  >();
  private readonly itemCollections = new Map<string, BitwardenCollection>();

  constructor(options: BitwardenClientOptions = {}) {
    this.command = options.command ?? "bw";
    this.env = { ...process.env, ...options.env };
    this.runner = options.runner ?? runCommand;
    this.removeTemporaryDirectory =
      options.removeTemporaryDirectory ??
      ((directory) => rm(directory, { recursive: true, force: true }));
  }

  async read(
    collectionId: ReadableCollectionId,
    selectors: readonly ExpandedSecretSelector[],
  ): Promise<BitwardenSecret[]> {
    const mapping = getCollectionMapping(collectionId);
    await this.ensureSession();
    await this.runOrThrow(["sync"], "Bitwarden sync failed");
    const collection = await this.resolveCollection(
      mapping.bitwardenCollection,
    );
    const result: BitwardenSecret[] = [];
    const names = new Set<string>();

    for (const selector of selectors) {
      const items = await this.readSelector(collection, selector);
      if (items.length === 0 && !selector.optional) {
        throw new Error(
          `Required prefix has no matching item: ${selector.prefix}`,
        );
      }
      for (const item of items) {
        if (names.has(item.name)) {
          throw new Error(`Duplicate Bitwarden item name: ${item.name}`);
        }
        names.add(item.name);
        result.push(item);
      }
    }

    return result;
  }

  async readItem(
    collectionId: ReadableCollectionId,
    name: string,
  ): Promise<BitwardenSecretItem> {
    const item = await this.findItem(collectionId, name);
    if (!item) throw new Error(`Bitwarden item not found: ${name}`);
    return item;
  }

  async findItem(
    collectionId: ReadableCollectionId,
    name: string,
  ): Promise<BitwardenSecretItem | undefined> {
    const mapping = getCollectionMapping(collectionId);
    await this.ensureSession();
    await this.runOrThrow(["sync"], "Bitwarden sync failed");
    const collection = await this.resolveCollection(
      mapping.bitwardenCollection,
    );
    const listed = await this.runOrThrow(
      ["list", "items", "--collectionid", collection.id, "--search", name],
      `Bitwarden item listing failed for ${name}`,
    );
    const values = parseJson(listed, `Bitwarden item list for ${name}`);
    if (!Array.isArray(values)) {
      throw new Error(`Bitwarden returned an invalid item list for ${name}`);
    }
    const matches: BitwardenSecretItem[] = [];
    for (const value of values) {
      if (
        isRecord(value) &&
        typeof value.name === "string" &&
        value.name !== name
      )
        continue;
      if (!isRecord(value) || typeof value.id !== "string" || !value.id) {
        throw new Error(`Bitwarden returned an item without an id for ${name}`);
      }
      const item = isCompleteItem(value, true)
        ? await this.parseItem(value, value.id, collection, name, true)
        : await this.readItemById(value.id, collection, name);
      if (item.name === name) matches.push(item);
    }
    if (matches.length === 0) return undefined;
    if (matches.length > 1)
      throw new Error(`Bitwarden item name is ambiguous: ${name}`);
    return matches[0]!;
  }

  async createItem(
    collectionId: ReadableCollectionId,
    name: string,
    value: string,
    storage: BitwardenSecretStorage,
  ): Promise<BitwardenSecretItem> {
    const mapping = getCollectionMapping(collectionId);
    await this.ensureSession();
    await this.runOrThrow(["sync"], "Bitwarden sync failed");
    const collection = await this.resolveCollection(
      mapping.bitwardenCollection,
    );

    const payload = this.itemPayload({
      name,
      collection,
      notes: storage === "note" ? value : null,
      attachments: [],
    });
    const encoded = this.encodeItem(payload);
    const created = await this.runOrThrow(
      ["create", "item"],
      `Bitwarden item creation failed for ${name}`,
      encoded,
    );
    const createdValue = parseJson(
      created,
      `Bitwarden item creation for ${name}`,
    );
    const createdId =
      isRecord(createdValue) && typeof createdValue.id === "string"
        ? createdValue.id
        : undefined;
    if (!createdId) {
      throw new Error(`Bitwarden item creation returned no id: ${name}`);
    }

    try {
      if (storage === "attachment") {
        await this.createAttachment(
          createdId,
          attachmentFileName(name),
          value,
          name,
        );
      }
      const verified =
        storage === "note" &&
        isRecord(createdValue) &&
        isCompleteItem(createdValue, true)
          ? await this.parseItem(
              createdValue,
              createdId,
              collection,
              name,
              true,
            )
          : await this.refreshItemById(createdId, collection, name);
      if (verified.value !== value || verified.storage !== storage) {
        throw new Error(`Bitwarden read-back verification failed: ${name}`);
      }
      return verified;
    } catch (error) {
      try {
        await this.deleteItemById(createdId, name);
      } catch {
        throw new Error(
          `Bitwarden item creation failed and cleanup failed: ${name}`,
          { cause: error },
        );
      }
      throw error;
    }
  }

  async deleteItem(item: BitwardenSecretItem): Promise<void> {
    await this.ensureSession();
    const collection = this.collectionForItem(item);
    await this.deleteItemById(item.id, item.name);
    await this.runOrThrow(["sync"], "Bitwarden sync failed");
    if (await this.findItemInCollection(collection, item.name)) {
      throw new Error(
        `Bitwarden item deletion could not be verified: ${item.name}`,
      );
    }
  }

  async updateItem(
    item: BitwardenSecretItem,
    value: string,
    storage: BitwardenSecretStorage = item.storage,
  ): Promise<BitwardenSecretItem> {
    const current = await this.refreshItem(item);
    if (current.revisionDate !== item.revisionDate) {
      throw new Error(`Bitwarden item changed before update: ${item.name}`);
    }
    item = current;
    if (item.value === value && item.storage === storage) return item;

    if (item.storage === storage && item.storage === "note") {
      const edited = await this.editItem(
        item.id,
        this.updatedItemPayload(item, value, "note"),
        item.name,
      );
      const updatedValue = parseJson(
        edited,
        `Bitwarden update for ${item.name}`,
      );
      const updated = await this.parseItem(
        updatedValue,
        item.id,
        this.collectionForItem(item),
        item.name,
        true,
      );
      if (updated.value !== value || updated.storage !== "note") {
        throw new Error(
          `Bitwarden read-back verification failed: ${item.name}`,
        );
      }
      return updated;
    }

    if (item.storage === storage && item.storage === "attachment") {
      return this.updateAttachment(item, value);
    }

    if (storage === "attachment") {
      return this.convertNoteToAttachment(item, value);
    }
    return this.convertAttachmentToNote(item, value);
  }

  private async resolveCollection(
    collectionName: string,
  ): Promise<BitwardenCollection> {
    const cached = this.collections.get(collectionName);
    if (cached) return cached;
    const pending = this.loadCollection(collectionName).catch((error) => {
      this.collections.delete(collectionName);
      throw error;
    });
    this.collections.set(collectionName, pending);
    return pending;
  }

  private async loadCollection(
    collectionName: string,
  ): Promise<BitwardenCollection> {
    const result = await this.runOrThrow(
      ["list", "collections"],
      "Bitwarden collection listing failed",
    );
    const values = parseJson(result, "Bitwarden collection list");
    if (!Array.isArray(values)) {
      throw new Error("Bitwarden returned an invalid collection list");
    }

    const matches = values.filter(
      (value): value is Record<string, unknown> =>
        isRecord(value) && value.name === collectionName,
    );
    if (matches.length === 0) {
      throw new Error(`Bitwarden collection not found: ${collectionName}`);
    }
    if (matches.length > 1) {
      throw new Error(
        `Bitwarden collection name is ambiguous: ${collectionName}`,
      );
    }

    const match = matches[0];
    if (
      typeof match.id !== "string" ||
      typeof match.name !== "string" ||
      typeof match.organizationId !== "string"
    ) {
      throw new Error(
        `Bitwarden collection has invalid metadata: ${collectionName}`,
      );
    }
    return {
      id: match.id,
      name: match.name,
      organizationId: match.organizationId,
    };
  }

  private async readSelector(
    collection: BitwardenCollection,
    selector: ExpandedSecretSelector,
  ): Promise<BitwardenSecret[]> {
    const result = await this.runOrThrow(
      [
        "list",
        "items",
        "--collectionid",
        collection.id,
        "--search",
        selector.prefix,
      ],
      `Bitwarden item listing failed for ${selector.prefix}`,
    );
    const values = parseJson(
      result,
      `Bitwarden item list for ${selector.prefix}`,
    );
    if (!Array.isArray(values)) {
      throw new Error(
        `Bitwarden returned an invalid item list for ${selector.prefix}`,
      );
    }

    const listedItems = values.flatMap((value) => {
      if (
        !isRecord(value) ||
        typeof value.id !== "string" ||
        value.id.length === 0
      ) {
        throw new Error(
          `Bitwarden returned an item without an id for ${selector.prefix}`,
        );
      }
      if (
        typeof value.name === "string" &&
        !value.name.startsWith(selector.prefix)
      ) {
        return [];
      }
      return [{ id: value.id, value }];
    });
    if (new Set(listedItems.map(({ id }) => id)).size !== listedItems.length) {
      throw new Error(`Duplicate Bitwarden item id for ${selector.prefix}`);
    }

    const items: BitwardenSecret[] = [];
    for (const listed of listedItems) {
      const item = isCompleteItem(listed.value, false)
        ? await this.parseItem(
            listed.value,
            listed.id,
            collection,
            selector.prefix,
            false,
          )
        : await this.readItemById(
            listed.id,
            collection,
            selector.prefix,
            false,
          );
      if (!item.name.startsWith(selector.prefix)) continue;
      items.push({
        id: item.id,
        name: item.name,
        value: item.value,
        selector,
      });
    }
    return items;
  }

  private async ensureSession(): Promise<void> {
    if (!this.env.BW_SESSION?.trim()) {
      throw new Error(
        "BW_SESSION is required and must contain an unlocked Bitwarden session",
      );
    }
    if (!this.sessionCheck) {
      this.sessionCheck = this.checkSession().catch((error) => {
        this.sessionCheck = undefined;
        throw error;
      });
    }
    await this.sessionCheck;
  }

  private async checkSession(): Promise<void> {
    await this.runOrThrow(["--version"], "Bitwarden CLI is unavailable");
    const status = await this.runOrThrow(
      ["status"],
      "Bitwarden session status could not be checked",
    );
    const statusJson = parseJson(status, "Bitwarden status");
    if (!isRecord(statusJson) || statusJson.status !== "unlocked") {
      throw new Error("BW_SESSION is missing or Bitwarden is not unlocked");
    }
  }

  private async readItemById(
    id: string,
    collection: BitwardenCollection,
    label: string,
    requireRevision = true,
  ): Promise<BitwardenSecretItem> {
    const result = await this.runOrThrow(
      ["get", "item", id],
      `Bitwarden item read failed for ${label}`,
    );
    return this.parseItem(
      parseJson(result, `Bitwarden item ${id}`),
      id,
      collection,
      label,
      requireRevision,
    );
  }

  private async parseItem(
    input: unknown,
    id: string,
    collection: BitwardenCollection,
    label: string,
    requireRevision: boolean,
  ): Promise<BitwardenSecretItem> {
    const value = input;
    if (!isRecord(value)) {
      throw new Error(`Bitwarden returned an invalid item for ${label}`);
    }
    if (
      value.id !== id ||
      typeof value.name !== "string" ||
      value.type !== 2 ||
      !Array.isArray(value.collectionIds) ||
      value.collectionIds.length !== 1 ||
      value.collectionIds[0] !== collection.id ||
      value.organizationId !== collection.organizationId ||
      (requireRevision &&
        (typeof value.revisionDate !== "string" ||
          value.revisionDate.length === 0))
    ) {
      throw new Error(
        `Bitwarden item ${typeof value.name === "string" ? value.name : id} is not a valid secure note in the selected collection`,
      );
    }
    const attachment = parseAttachment(value.attachments, label);
    if (attachment === undefined) {
      if (typeof value.notes !== "string") {
        throw new Error(`Bitwarden secure note has no value: ${value.name}`);
      }
      const item: BitwardenSecretItem = {
        id,
        name: value.name,
        value: value.notes,
        storage: "note",
        revisionDate:
          typeof value.revisionDate === "string" ? value.revisionDate : "",
        raw: value,
        attachments: [],
      };
      this.itemCollections.set(id, collection);
      return item;
    }
    if (
      value.notes !== null &&
      (typeof value.notes !== "string" || value.notes.length > 0)
    ) {
      throw new Error(
        requireRevision
          ? `Bitwarden item notes must be empty with an attachment: ${value.name}`
          : `Bitwarden item notes must be null or empty when an attachment is present for ${label}`,
      );
    }
    if (attachment.fileName !== attachmentFileName(value.name)) {
      throw new Error(
        `Bitwarden attachment filename does not match the item basename: ${value.name}`,
      );
    }
    const attachmentResult = await this.runOrThrow(
      ["get", "attachment", attachment.fileName, "--itemid", id, "--raw"],
      `Bitwarden attachment read failed for ${label}`,
    );
    const item: BitwardenSecretItem = {
      id,
      name: value.name,
      value: attachmentResult.stdout,
      storage: "attachment",
      revisionDate:
        typeof value.revisionDate === "string" ? value.revisionDate : "",
      raw: value,
      attachments: [attachment],
      attachment,
    };
    this.itemCollections.set(id, collection);
    return item;
  }

  private async refreshItem(
    item: BitwardenSecretItem,
  ): Promise<BitwardenSecretItem> {
    await this.runOrThrow(["sync"], "Bitwarden sync failed");
    return this.readItemById(item.id, this.collectionForItem(item), item.name);
  }

  private async refreshItemById(
    id: string,
    collection: BitwardenCollection,
    name: string,
  ): Promise<BitwardenSecretItem> {
    await this.runOrThrow(["sync"], "Bitwarden sync failed");
    return this.readItemById(id, collection, name);
  }

  private async findItemInCollection(
    collection: BitwardenCollection,
    name: string,
  ): Promise<BitwardenSecretItem | undefined> {
    const listed = await this.runOrThrow(
      ["list", "items", "--collectionid", collection.id, "--search", name],
      `Bitwarden item listing failed for ${name}`,
    );
    const values = parseJson(listed, `Bitwarden item list for ${name}`);
    if (!Array.isArray(values)) {
      throw new Error(`Bitwarden returned an invalid item list for ${name}`);
    }
    for (const value of values) {
      if (
        isRecord(value) &&
        typeof value.name === "string" &&
        value.name !== name
      )
        continue;
      if (!isRecord(value) || typeof value.id !== "string" || !value.id) {
        throw new Error(`Bitwarden returned an item without an id for ${name}`);
      }
      const item = isCompleteItem(value, true)
        ? await this.parseItem(value, value.id, collection, name, true)
        : await this.readItemById(value.id, collection, name);
      if (item.name === name) return item;
    }
    return undefined;
  }

  private collectionForItem(item: BitwardenSecretItem): BitwardenCollection {
    const collection = this.itemCollections.get(item.id);
    if (!collection) {
      throw new Error(
        "Bitwarden collection must be loaded before changing an item",
      );
    }
    return collection;
  }

  private async deleteItemById(id: string, name: string): Promise<void> {
    await this.runOrThrow(
      ["delete", "item", id],
      `Bitwarden item deletion failed for ${name}`,
    );
  }

  private itemPayload(options: {
    name: string;
    collection: BitwardenCollection;
    notes: string | null;
    attachments: readonly unknown[];
  }): Record<string, unknown> {
    return {
      type: 2,
      name: options.name,
      notes: options.notes,
      attachments: options.attachments,
      collectionIds: [options.collection.id],
      organizationId: options.collection.organizationId,
      secureNote: { type: 0 },
      login: null,
      card: null,
      identity: null,
    };
  }

  private updatedItemPayload(
    item: BitwardenSecretItem,
    value: string,
    storage: BitwardenSecretStorage,
  ): Record<string, unknown> {
    return {
      ...item.raw,
      name: item.name,
      notes: storage === "note" ? value : null,
      attachments: [],
      type: 2,
      collectionIds: item.raw.collectionIds,
      organizationId: item.raw.organizationId,
      secureNote: { type: 0 },
      login: null,
      card: null,
      identity: null,
    };
  }

  private encodeItem(payload: Record<string, unknown>): string {
    return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
  }

  private async updateAttachment(
    item: BitwardenSecretItem,
    value: string,
  ): Promise<BitwardenSecretItem> {
    if (!item.attachment) {
      throw new Error(`Bitwarden attachment metadata missing: ${item.name}`);
    }
    try {
      await this.runOrThrow(
        ["delete", "attachment", item.attachment.id],
        `Bitwarden attachment update failed for ${item.name}`,
      );
      await this.createAttachment(
        item.id,
        item.attachment.fileName,
        value,
        item.name,
      );
      const updated = await this.refreshItem(item);
      if (updated.value !== value) {
        throw new Error(
          `Bitwarden read-back verification failed: ${item.name}`,
        );
      }
      return updated;
    } catch (error) {
      await this.restoreAttachment(item);
      if (
        error instanceof Error &&
        /read-back verification failed/.test(error.message)
      ) {
        throw error;
      }
      throw new Error(`Bitwarden attachment update failed: ${item.name}`, {
        cause: error,
      });
    }
  }

  private async convertNoteToAttachment(
    item: BitwardenSecretItem,
    value: string,
  ): Promise<BitwardenSecretItem> {
    let attachmentUploaded = false;
    try {
      await this.editItem(
        item.id,
        this.updatedItemPayload(item, value, "attachment"),
        item.name,
      );
      await this.createAttachment(
        item.id,
        attachmentFileName(item.name),
        value,
        item.name,
      );
      attachmentUploaded = true;
      const updated = await this.refreshItem(item);
      if (updated.storage !== "attachment" || updated.value !== value) {
        throw new Error(
          `Bitwarden read-back verification failed: ${item.name}`,
        );
      }
      return updated;
    } catch (error) {
      let attachmentCleanupError: unknown;
      if (attachmentUploaded) {
        try {
          await this.removeUploadedAttachment(item);
        } catch (cleanupError) {
          attachmentCleanupError = cleanupError;
        }
      }
      try {
        await this.restoreNote(item);
      } catch {
        throw new Error(
          `Bitwarden update failed and note rollback failed: ${item.name}`,
          { cause: error },
        );
      }
      if (attachmentCleanupError !== undefined) {
        throw new Error(
          `Bitwarden update failed and attachment rollback failed: ${item.name}`,
          { cause: error },
        );
      }
      throw error;
    }
  }

  private async removeUploadedAttachment(
    item: BitwardenSecretItem,
  ): Promise<void> {
    const attachment = (await this.readAttachmentMetadata(item)).find(
      ({ fileName }) => fileName === attachmentFileName(item.name),
    );
    if (!attachment) return;
    await this.runOrThrow(
      ["delete", "attachment", attachment.id],
      `Bitwarden attachment rollback failed for ${item.name}`,
    );
  }

  private async convertAttachmentToNote(
    item: BitwardenSecretItem,
    value: string,
  ): Promise<BitwardenSecretItem> {
    if (!item.attachment) {
      throw new Error(`Bitwarden attachment metadata missing: ${item.name}`);
    }
    try {
      await this.runOrThrow(
        ["delete", "attachment", item.attachment.id],
        `Bitwarden attachment update failed for ${item.name}`,
      );
      await this.editItem(
        item.id,
        this.updatedItemPayload(item, value, "note"),
        item.name,
      );
      const updated = await this.refreshItem(item);
      if (updated.storage !== "note" || updated.value !== value) {
        throw new Error(
          `Bitwarden read-back verification failed: ${item.name}`,
        );
      }
      return updated;
    } catch (error) {
      await this.restoreAttachment(item);
      throw error;
    }
  }

  private async restoreNote(item: BitwardenSecretItem): Promise<void> {
    try {
      await this.editItem(
        item.id,
        this.updatedItemPayload(item, item.value, "note"),
        item.name,
      );
    } catch {
      throw new Error(
        `Bitwarden update failed and note rollback failed: ${item.name}`,
      );
    }
  }

  private async restoreAttachment(item: BitwardenSecretItem): Promise<void> {
    if (!item.attachment) {
      throw new Error(`Bitwarden attachment metadata missing: ${item.name}`);
    }
    try {
      await this.editItem(
        item.id,
        this.updatedItemPayload(item, item.value, "attachment"),
        item.name,
      );
      const attachments = await this.readAttachmentMetadata(item);
      for (const attachment of attachments) {
        if (attachment.fileName === item.attachment.fileName) {
          await this.runOrThrow(
            ["delete", "attachment", attachment.id],
            `Bitwarden attachment rollback failed for ${item.name}`,
          );
        }
      }
      await this.createAttachment(
        item.id,
        item.attachment.fileName,
        item.value,
        item.name,
      );
    } catch {
      throw new Error(
        `Bitwarden update failed and attachment rollback failed: ${item.name}`,
      );
    }
  }

  private async readAttachmentMetadata(
    item: BitwardenSecretItem,
  ): Promise<readonly BitwardenAttachment[]> {
    const result = await this.runOrThrow(
      ["get", "item", item.id],
      `Bitwarden item read failed for ${item.name}`,
    );
    const value = parseJson(result, `Bitwarden item ${item.id}`);
    if (!isRecord(value) || value.id !== item.id) {
      throw new Error(`Bitwarden item read-back failed: ${item.name}`);
    }
    const attachment = parseAttachment(value.attachments, item.name);
    return attachment === undefined ? [] : [attachment];
  }

  private async editItem(
    id: string,
    payload: Record<string, unknown>,
    name: string,
  ): Promise<CommandResult> {
    const encoded = this.encodeItem(payload);
    return this.runOrThrow(
      ["edit", "item", id],
      `Bitwarden update failed for ${name}`,
      encoded,
    );
  }

  private async createAttachment(
    itemId: string,
    fileName: string,
    value: string,
    name: string,
  ): Promise<void> {
    if (path.basename(fileName) !== fileName) {
      throw new Error(`Bitwarden attachment filename is unsafe: ${name}`);
    }
    const directory = await mkdtemp(path.join(os.tmpdir(), "rhdh-e2e-secret-"));
    const filePath = path.join(directory, fileName);
    let operationError: unknown;
    try {
      await writeFile(filePath, value, { encoding: "utf8", mode: 0o600 });
      await chmod(filePath, 0o600);
      await this.runOrThrow(
        ["create", "attachment", "--file", filePath, "--itemid", itemId],
        `Bitwarden attachment update failed for ${name}`,
      );
    } catch (error) {
      operationError = error;
    }
    let cleanupError: unknown;
    try {
      await this.removeTemporaryDirectory(directory);
    } catch (error) {
      cleanupError = error;
    }
    if (operationError !== undefined) {
      if (cleanupError !== undefined) {
        throw new Error(
          `Bitwarden attachment operation failed and temporary cleanup failed: ${name}`,
          { cause: new AggregateError([operationError, cleanupError]) },
        );
      }
      throw operationError;
    }
    if (cleanupError !== undefined) {
      throw new Error(
        `Bitwarden attachment operation may have succeeded but temporary cleanup failed: ${name}`,
        { cause: cleanupError },
      );
    }
  }

  private async runOrThrow(
    args: readonly string[],
    message: string,
    input?: string,
  ): Promise<CommandResult> {
    let result: CommandResult;
    try {
      result = await this.runner(this.command, args, {
        env: this.env,
        ...(input === undefined ? {} : { input }),
      });
    } catch {
      throw new Error(message);
    }
    if (result.status !== 0) throw new Error(message);
    return result;
  }
}

function parseJson(result: CommandResult, label: string): unknown {
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error(`${label} returned invalid JSON`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCompleteItem(
  value: Record<string, unknown>,
  requireRevision: boolean,
): boolean {
  return (
    typeof value.id === "string" &&
    "name" in value &&
    "type" in value &&
    "collectionIds" in value &&
    "organizationId" in value &&
    "notes" in value &&
    (!requireRevision || "revisionDate" in value)
  );
}

function parseAttachment(
  value: unknown,
  prefix: string,
): BitwardenAttachment | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) {
    throw new Error(
      `Bitwarden item has invalid attachment metadata for ${prefix}`,
    );
  }
  if (value.length === 0) return undefined;
  if (value.length !== 1) {
    throw new Error(
      `Bitwarden item must have exactly one attachment for ${prefix}`,
    );
  }

  const attachment = value[0];
  if (
    !isRecord(attachment) ||
    typeof attachment.id !== "string" ||
    attachment.id.length === 0 ||
    typeof attachment.fileName !== "string" ||
    attachment.fileName.length === 0
  ) {
    throw new Error(
      `Bitwarden item has invalid attachment metadata for ${prefix}`,
    );
  }
  return { id: attachment.id, fileName: attachment.fileName };
}

function attachmentFileName(name: string): string {
  const basename = name.split("/").at(-1) ?? name;
  const sanitized = basename.replace(/[^A-Za-z0-9._-]/g, "_");
  return sanitized || "secret";
}
