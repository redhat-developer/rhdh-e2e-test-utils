function envsubst(str: string, env = process.env) {
  const out = str.replace(
    /\$([A-Za-z_]\w*)|\$\{([A-Za-z_]\w*)(?::-(.*?))?\}/g,
    (_, v1, v2, def) => {
      const k = v1 || v2;
      return env[k] ?? (def !== undefined ? def : "");
    },
  );
  return out;
}

function requireEnv(...varNames: [string, ...string[]]): void {
  for (const varName of varNames) {
    const value = process.env[varName];
    if (!value) {
      throw new Error(`Required variable ${varName} is not set`);
    }
  }
}

/**
 * Whether this run should deploy instrumented bundles and collect coverage.
 *
 * Read from two layers that have to agree — plugin resolution picks the
 * `__coverage` OCI tag, the Playwright fixture reads `__coverage__` back out —
 * so the check lives in one place rather than as a string compare in each.
 */
function isCoverageEnabled(): boolean {
  return process.env.E2E_COLLECT_COVERAGE === "true";
}

export { envsubst, requireEnv, isCoverageEnabled };
