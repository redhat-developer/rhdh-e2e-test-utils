import type { ExpandedSecretSelector } from "./config.js";

export interface EnvironmentSecret {
  id: string;
  name: string;
  value: string;
  selector: ExpandedSecretSelector;
}

const ENVIRONMENT_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
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
    if (mapped.has(key)) {
      throw new Error(`Environment variable collision: ${key}`);
    }
    mapped.set(key, secret.value);
  }

  for (const [key, value] of mapped) child[key] = value;
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
