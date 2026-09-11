import type { ExpandedSecretSelector } from "./config.js";

export interface EnvironmentSecret {
  id: string;
  name: string;
  value: string;
  selector: ExpandedSecretSelector;
}

export interface MaterializedEnvironment {
  environment: NodeJS.ProcessEnv;
  secretNames: readonly string[];
}

const ENVIRONMENT_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
export const SECRET_NAMES_ENVIRONMENT_VARIABLE = "RHDH_E2E_SECRET_NAMES";
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
  return materializeEnvironmentWithSecretNames(secrets, selectors, parent)
    .environment;
}

export function materializeEnvironmentWithSecretNames(
  secrets: readonly EnvironmentSecret[],
  selectors: readonly ExpandedSecretSelector[],
  parent: NodeJS.ProcessEnv = process.env,
): MaterializedEnvironment {
  const child = { ...parent };
  removeProviderEnvironmentVariables(child);

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
    if (!ENVIRONMENT_NAME.test(key)) {
      throw new Error(`Invalid environment variable name: ${key}`);
    }
    if (key === SECRET_NAMES_ENVIRONMENT_VARIABLE) {
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
    secretNames: [...mapped.keys()].sort(),
  };
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
