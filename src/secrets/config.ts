export type ReadableCollectionId =
  | "rhdh-qe"
  | "rhdh-test-instance"
  | "rhdh-plugin-export-overlays";

export interface CollectionMapping {
  id: ReadableCollectionId;
  bitwardenCollection: string;
}

export interface SecretProfile {
  schemaVersion: 1;
  collection: ReadableCollectionId;
  selectors: readonly SecretSelector[];
}

export interface SecretSelector {
  prefix: string;
  destination: EnvironmentDestination;
  optional?: boolean;
}

export interface EnvironmentDestination {
  kind: "environment";
  stripPrefix: string;
  requirePrefix?: string;
  keyTransform: "identity" | "legacy-env";
}

export interface ExpandedSecretSelector extends SecretSelector {
  optional: boolean;
}

export interface ExpandedSecretProfile {
  schemaVersion: 1;
  collection: ReadableCollectionId;
  selectors: readonly ExpandedSecretSelector[];
}

const COLLECTIONS: readonly CollectionMapping[] = [
  {
    id: "rhdh-qe",
    bitwardenCollection: "Rhdh Qe Ci Secrets",
  },
  {
    id: "rhdh-test-instance",
    bitwardenCollection: "Rhdh Test Instance Ci Secrets",
  },
  {
    id: "rhdh-plugin-export-overlays",
    bitwardenCollection: "Rhdh Plugin Export Overlays Ci Secrets",
  },
];

const DENIED_COLLECTION = "rhdh-aws-credentials";
const WORKSPACE_TOKEN = "${workspace}";
const WORKSPACE_NAME = /^[a-z0-9][a-z0-9-]*$/;

export function getCollectionMapping(collection: string): CollectionMapping {
  if (collection === DENIED_COLLECTION) {
    throw new Error(
      `Collection ${DENIED_COLLECTION} is GSM-only and cannot be read from Bitwarden`,
    );
  }

  if (!isReadableCollectionId(collection)) {
    throw new Error(`Unknown Bitwarden collection: ${collection}`);
  }

  return COLLECTIONS.find((mapping) => mapping.id === collection)!;
}

export function parseProfile(value: unknown): SecretProfile {
  if (!isRecord(value) || value.schemaVersion !== 1) {
    throw new Error("Invalid secret profile: schemaVersion must be 1");
  }

  if (typeof value.collection !== "string") {
    throw new Error("Invalid secret profile: collection is required");
  }
  const collection = getCollectionMapping(value.collection).id;

  if (!Array.isArray(value.selectors) || value.selectors.length === 0) {
    throw new Error("Invalid secret profile: selectors must not be empty");
  }

  const selectors = value.selectors.map((selector, index) =>
    parseSelector(selector, index),
  );
  const selectorKeys = selectors.map((selector) => selector.prefix);
  if (new Set(selectorKeys).size !== selectorKeys.length) {
    throw new Error("Invalid secret profile: duplicate selector");
  }

  return { schemaVersion: 1, collection, selectors };
}

export function expandProfile(
  profile: SecretProfile,
  workspaces: readonly string[] = [],
): ExpandedSecretProfile {
  const hasWorkspaceToken = profile.selectors.some((selector) =>
    selector.prefix.includes(WORKSPACE_TOKEN),
  );

  if (!hasWorkspaceToken && workspaces.length > 0) {
    throw new Error("Secret profile does not accept workspace arguments");
  }
  if (hasWorkspaceToken && workspaces.length === 0) {
    throw new Error("Secret profile requires at least one workspace argument");
  }

  for (const workspace of workspaces) {
    if (!WORKSPACE_NAME.test(workspace)) {
      throw new Error(`Invalid workspace name: ${workspace}`);
    }
  }
  if (new Set(workspaces).size !== workspaces.length) {
    throw new Error("Duplicate workspace argument");
  }

  const selectors: ExpandedSecretSelector[] = [];
  for (const selector of profile.selectors) {
    const values = selector.prefix.includes(WORKSPACE_TOKEN)
      ? workspaces
      : [undefined];
    for (const workspace of values) {
      selectors.push({
        ...selector,
        prefix: expandToken(selector.prefix, workspace),
        destination: {
          ...selector.destination,
          stripPrefix: expandToken(selector.destination.stripPrefix, workspace),
        },
        optional: selector.optional === true,
      });
    }
  }

  return {
    schemaVersion: 1,
    collection: profile.collection,
    selectors,
  };
}

function parseSelector(value: unknown, index: number): SecretSelector {
  if (!isRecord(value)) {
    throw new Error(`Invalid secret selector at index ${index}`);
  }
  if (typeof value.prefix !== "string" || value.prefix.length === 0) {
    throw new Error(
      `Invalid secret selector at index ${index}: prefix is required`,
    );
  }
  validateTokenCount(value.prefix, `selector ${index} prefix`);
  if (!value.prefix.endsWith("/")) {
    throw new Error(
      `Invalid secret selector at index ${index}: prefix must end with /`,
    );
  }

  if (
    !isRecord(value.destination) ||
    value.destination.kind !== "environment"
  ) {
    throw new Error(
      `Invalid secret selector at index ${index}: destination must be an environment`,
    );
  }
  const destination = value.destination;
  if (
    typeof destination.stripPrefix !== "string" ||
    destination.stripPrefix.length === 0
  ) {
    throw new Error(
      `Invalid secret selector at index ${index}: stripPrefix is required`,
    );
  }
  validateTokenCount(destination.stripPrefix, `selector ${index} stripPrefix`);
  if (!destination.stripPrefix.endsWith("/")) {
    throw new Error(
      `Invalid secret selector at index ${index}: stripPrefix must end with /`,
    );
  }
  if (!value.prefix.startsWith(destination.stripPrefix)) {
    throw new Error(
      `Invalid secret selector at index ${index}: stripPrefix must be a prefix of prefix`,
    );
  }
  if (
    typeof destination.requirePrefix !== "undefined" &&
    (typeof destination.requirePrefix !== "string" ||
      destination.requirePrefix.length === 0)
  ) {
    throw new Error(
      `Invalid secret selector at index ${index}: requirePrefix must be non-empty`,
    );
  }
  if (
    destination.keyTransform !== "identity" &&
    destination.keyTransform !== "legacy-env"
  ) {
    throw new Error(
      `Invalid secret selector at index ${index}: unsupported keyTransform`,
    );
  }
  if (
    typeof value.optional !== "undefined" &&
    typeof value.optional !== "boolean"
  ) {
    throw new Error(
      `Invalid secret selector at index ${index}: optional must be boolean`,
    );
  }

  return {
    prefix: value.prefix,
    optional: value.optional === true,
    destination: {
      kind: "environment",
      stripPrefix: destination.stripPrefix,
      ...(typeof destination.requirePrefix === "string"
        ? { requirePrefix: destination.requirePrefix }
        : {}),
      keyTransform: destination.keyTransform,
    },
  };
}

function expandToken(value: string, workspace: string | undefined): string {
  if (!value.includes(WORKSPACE_TOKEN)) return value;
  if (workspace === undefined) {
    throw new Error(`Missing workspace for selector: ${value}`);
  }
  return value.replace(WORKSPACE_TOKEN, workspace);
}

function validateTokenCount(value: string, label: string): void {
  const count = value.split(WORKSPACE_TOKEN).length - 1;
  if (count > 1) {
    throw new Error(`${label} may contain ${WORKSPACE_TOKEN} at most once`);
  }
}

function isReadableCollectionId(value: string): value is ReadableCollectionId {
  return COLLECTIONS.some((mapping) => mapping.id === value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
