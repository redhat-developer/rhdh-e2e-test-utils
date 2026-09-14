import type { ExpandedSecretSelector } from "./config.js";
import {
  SECRET_STREAM_ENVIRONMENT_VARIABLE,
  SECRET_STREAM_FD,
} from "./stream.js";
import { isValidEnvironmentName } from "./environment-name.js";

export interface EnvironmentSecret {
  id: string;
  name: string;
  value: string;
  selector: ExpandedSecretSelector;
}

export interface MaterializedEnvironment {
  environment: NodeJS.ProcessEnv;
  secrets: readonly MaterializedSecret[];
}

export interface MaterializedSecret {
  name: string;
  value: string;
}

const PROVIDER_ENVIRONMENT_KEYS = new Set([
  "VAULT",
  "VAULT_TOKEN",
  "VAULT_ADDR",
  "VAULT_BASE_PATH",
]);

export function removeProviderEnvironmentVariables(
  environment: NodeJS.ProcessEnv,
): void {
  for (const key of Object.keys(environment)) {
    if (key.startsWith("BW_") || PROVIDER_ENVIRONMENT_KEYS.has(key)) {
      delete environment[key];
    }
  }
}

export function materializeEnvironment(
  secrets: readonly EnvironmentSecret[],
  selectors: readonly ExpandedSecretSelector[],
  parent: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  return materializeEnvironmentWithSecrets(secrets, selectors, parent)
    .environment;
}

export function materializeEnvironmentWithSecrets(
  secrets: readonly EnvironmentSecret[],
  selectors: readonly ExpandedSecretSelector[],
  parent: NodeJS.ProcessEnv = process.env,
): MaterializedEnvironment {
  const child = { ...parent };
  removeProviderEnvironmentVariables(child);
  delete child[SECRET_STREAM_ENVIRONMENT_VARIABLE];

  const mapped = new Map<string, string>();
  for (const secret of secrets) {
    const selector = selectors.find((candidate) =>
      sameSelector(candidate, secret.selector),
    );
    if (!selector) {
      throw new Error(`Secret ${secret.name} does not match selector`);
    }
    if (!secret.name.startsWith(selector.prefix)) {
      throw new Error(
        `Secret ${secret.name} does not match selector ${selector.prefix}`,
      );
    }

    const relativeName = secret.name.slice(
      selector.destination.stripPrefix.length,
    );
    if (selector.destination.requirePrefix !== undefined) {
      if (!relativeName.startsWith(selector.destination.requirePrefix))
        continue;
    }
    const key = transformEnvironmentName(
      relativeName,
      selector.destination.keyTransform,
    );
    if (!isValidEnvironmentName(key)) {
      throw new Error(`Invalid environment variable name: ${key}`);
    }
    if (key === SECRET_STREAM_ENVIRONMENT_VARIABLE) {
      throw new Error(`Reserved environment variable name: ${key}`);
    }
    if (key.startsWith("BW_")) {
      throw new Error(
        `Bitwarden provider environment variable is not allowed: ${key}`,
      );
    }
    if (mapped.has(key)) {
      throw new Error(`Environment variable collision: ${key}`);
    }
    mapped.set(key, secret.value);
  }
  const mappedSecrets = [...mapped.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((left, right) =>
      left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
    );

  for (const [key, value] of mapped) {
    Object.defineProperty(child, key, {
      configurable: true,
      enumerable: true,
      value,
      writable: true,
    });
  }
  return {
    environment: child,
    secrets: mappedSecrets,
  };
}

export function materializeStreamEnvironment(
  materialized: MaterializedEnvironment,
): NodeJS.ProcessEnv {
  const child = { ...materialized.environment };
  for (const secret of materialized.secrets) delete child[secret.name];
  child[SECRET_STREAM_ENVIRONMENT_VARIABLE] = String(SECRET_STREAM_FD);
  return child;
}

function transformEnvironmentName(
  value: string,
  transform: ExpandedSecretSelector["destination"]["keyTransform"],
): string {
  return transform === "legacy-env" ? value.replace(/[.\-/]/g, "_") : value;
}

function sameSelector(
  left: ExpandedSecretSelector,
  right: ExpandedSecretSelector,
): boolean {
  return (
    left.prefix === right.prefix &&
    left.destination.stripPrefix === right.destination.stripPrefix &&
    left.destination.requirePrefix === right.destination.requirePrefix &&
    left.destination.keyTransform === right.destination.keyTransform
  );
}
