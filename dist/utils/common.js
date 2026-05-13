function envsubst(str, env = process.env) {
    const out = str.replace(/\$([A-Za-z_]\w*)|\$\{([A-Za-z_]\w*)(?::-(.*?))?\}/g, (_, v1, v2, def) => {
        const k = v1 || v2;
        return env[k] ?? (def !== undefined ? def : "");
    });
    return out;
}
function requireEnv(...varNames) {
    for (const varName of varNames) {
        const value = process.env[varName];
        if (!value) {
            throw new Error(`Required variable ${varName} is not set`);
        }
    }
}
export { envsubst, requireEnv };
