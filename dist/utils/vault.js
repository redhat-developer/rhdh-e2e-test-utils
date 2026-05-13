import { $ } from "./bash.js";
const VAULT_ADDR_DEFAULT = "https://vault.ci.openshift.org";
const VAULT_BASE_PATH_DEFAULT = "selfservice/rhdh-plugin-export-overlays";
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
export async function loadLocalVaultSecrets() {
    if (process.env.VAULT !== "1" && process.env.VAULT !== "true")
        return;
    const vaultAddr = process.env.VAULT_ADDR || VAULT_ADDR_DEFAULT;
    const basePath = process.env.VAULT_BASE_PATH || VAULT_BASE_PATH_DEFAULT;
    process.env.VAULT_ADDR = vaultAddr;
    // Check vault CLI is installed
    const whichResult = await vaultCmd `command -v vault`;
    if (whichResult.exitCode !== 0) {
        throw new Error("vault CLI not found. Install from https://developer.hashicorp.com/vault/downloads");
    }
    // Check if already logged in
    const tokenCheck = await vaultCmd `vault token lookup`;
    if (tokenCheck.exitCode !== 0) {
        console.log("Vault: not logged in, starting OIDC login...");
        // vault login needs inherited stdio for browser-based OIDC flow
        await $ `vault login -no-print -method=oidc`;
        const retryCheck = await vaultCmd `vault token lookup`;
        if (retryCheck.exitCode !== 0) {
            throw new Error("Vault login failed. Run manually:\n  export VAULT_ADDR='" +
                vaultAddr +
                "'\n  vault login -method=oidc");
        }
    }
    // Check access by fetching global secrets first
    const globalResult = await vaultCmd `vault kv get -format=json -mount=kv ${basePath}/global`;
    if (globalResult.stderr.includes("permission denied")) {
        console.log("Vault: permission denied. Request access in Slack: #rhdh-e2e-tests");
        return;
    }
    console.log("Loading secrets from vault...");
    // Load global secrets
    loadSecretsFromResult(globalResult, "global");
    // List and fetch per-workspace secrets
    const listResult = await vaultCmd `vault kv list -format=json -mount=kv ${basePath}/workspaces`;
    if (listResult.exitCode === 0) {
        const workspaces = JSON.parse(listResult.stdout);
        await Promise.all(workspaces.map((ws) => {
            const name = ws.replace(/\/$/, "");
            return exportSecretsFromPath(`${basePath}/workspaces/${name}`, name);
        }));
    }
    else {
        console.log("  No workspace-specific secrets found");
    }
    console.log("Vault secrets loaded successfully.");
}
/** Runs a shell command with piped stdio and nothrow, for capturing vault CLI output. */
const vaultCmd = $({
    stdio: ["pipe", "pipe", "pipe"],
    nothrow: true,
});
async function exportSecretsFromPath(vaultPath, label) {
    const result = await vaultCmd `vault kv get -format=json -mount=kv ${vaultPath}`;
    loadSecretsFromResult(result, label);
}
function loadSecretsFromResult(result, label) {
    if (result.exitCode !== 0) {
        console.log(`  No secrets at: ${label}`);
        return;
    }
    const json = JSON.parse(result.stdout);
    const secrets = json?.data?.data;
    if (!secrets) {
        console.log(`  No secrets at: ${label}`);
        return;
    }
    console.log(`  From: ${label}`);
    for (const [key, value] of Object.entries(secrets)) {
        if (key.startsWith("secretsync/"))
            continue;
        if (!key.startsWith("VAULT_"))
            continue;
        const safeKey = key.replace(/[.\-/]/g, "_");
        process.env[safeKey] = value;
    }
}
