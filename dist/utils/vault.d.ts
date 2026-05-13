/**
 * Loads secrets from HashiCorp Vault into process.env.
 * Only runs when `VAULT=1` or `VAULT=true` is set. Handles OIDC login automatically.
 *
 * Fetches secrets from:
 * - Global path: `<basePath>/global`
 * - Per-workspace paths: `<basePath>/workspaces/<name>`
 *
 * Configure via env vars:
 * - `VAULT_ADDR` — Vault server URL (default: https://vault.ci.openshift.org)
 * - `VAULT_BASE_PATH` — Base path in Vault (default: selfservice/rhdh-plugin-export-overlays)
 *
 * Security: Only key names are logged, never secret values.
 */
export declare function loadLocalVaultSecrets(): Promise<void>;
//# sourceMappingURL=vault.d.ts.map