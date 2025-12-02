function envsubst(str, env = process.env) {
    const out = str.replace(/\$([A-Za-z_]\w*)|\$\{([A-Za-z_]\w*)(?::-(.*?))?\}/g, (_, v1, v2, def) => {
        const k = v1 || v2;
        return env[k] ?? (def !== undefined ? def : "");
    });
    return out;
}
export { envsubst };
