import { runCommand, type CommandResult } from "./command.js";
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

interface BitwardenCollection {
  id: string;
  name: string;
  organizationId: string;
}

export interface BitwardenClientOptions {
  command?: string;
  env?: NodeJS.ProcessEnv;
  runner?: BitwardenCommandRunner;
}

export class BitwardenClient {
  private readonly command: string;
  private readonly env: NodeJS.ProcessEnv;
  private readonly runner: BitwardenCommandRunner;

  constructor(options: BitwardenClientOptions = {}) {
    this.command = options.command ?? "bw";
    this.env = { ...process.env, ...options.env };
    this.runner = options.runner ?? runCommand;
  }

  async read(
    collectionId: ReadableCollectionId,
    selectors: readonly ExpandedSecretSelector[],
  ): Promise<BitwardenSecret[]> {
    const mapping = getCollectionMapping(collectionId);
    if (!this.env.BW_SESSION?.trim()) {
      throw new Error(
        "BW_SESSION is required and must contain an unlocked Bitwarden session",
      );
    }

    await this.runOrThrow(["--version"], "Bitwarden CLI is unavailable");
    const status = await this.runOrThrow(
      ["status"],
      "Bitwarden session status could not be checked",
    );
    const statusJson = parseJson(status, "Bitwarden status");
    if (!isRecord(statusJson) || statusJson.status !== "unlocked") {
      throw new Error("BW_SESSION is missing or Bitwarden is not unlocked");
    }

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

  private async resolveCollection(
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

    const ids = values.flatMap((value) => {
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
      return [value.id];
    });
    if (new Set(ids).size !== ids.length) {
      throw new Error(`Duplicate Bitwarden item id for ${selector.prefix}`);
    }

    const items: BitwardenSecret[] = [];
    for (const id of ids) {
      const itemResult = await this.runOrThrow(
        ["get", "item", id],
        `Bitwarden item read failed for ${selector.prefix}`,
      );
      const value = parseJson(itemResult, `Bitwarden item ${id}`);
      if (!isRecord(value)) {
        throw new Error(
          `Bitwarden returned an invalid item for ${selector.prefix}`,
        );
      }
      if (
        typeof value.name !== "string" ||
        !value.name.startsWith(selector.prefix)
      ) {
        continue;
      }
      if (
        value.id !== id ||
        value.type !== 2 ||
        typeof value.notes !== "string" ||
        !Array.isArray(value.collectionIds) ||
        value.collectionIds.length !== 1 ||
        value.collectionIds[0] !== collection.id ||
        value.organizationId !== collection.organizationId
      ) {
        throw new Error(
          `Bitwarden item ${typeof value.name === "string" ? value.name : id} is not a secure note in the selected collection`,
        );
      }
      items.push({
        id,
        name: value.name,
        value: value.notes,
        selector,
      });
    }
    return items;
  }

  private async runOrThrow(
    args: readonly string[],
    message: string,
  ): Promise<CommandResult> {
    let result: CommandResult;
    try {
      result = await this.runner(this.command, args, { env: this.env });
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
