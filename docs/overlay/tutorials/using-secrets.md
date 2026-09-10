# Using Secrets

This page explains how to consume secret values in overlay E2E tests.

## Where Secrets Come From

In OpenShift CI, mounted secret files are exported as environment variables
with the `VAULT_` prefix. Local runs use the same variable names through the
Bitwarden wrapper.

For **local development**, unlock Bitwarden, export `BW_SESSION`, and run the
secret-backed script:

```bash
export BW_SESSION="<session-from-an-unlocked-bw-cli>"
yarn test:secrets
```

See [Running Locally](/overlay/tutorials/running-locally#secrets-from-bitwarden) for details.

## Secret Collections

### Secret Naming Convention

All secrets must start with the `VAULT_` prefix (e.g., `VAULT_API_KEY`).

### Global Secrets

Global secrets are available to **all** workspace tests. Use these for shared values.

The local profile selects the `global/` prefix from the approved Bitwarden
collection.

### Workspace-Specific Secrets

Secrets for a specific workspace use this item-name prefix:

```
workspaces/<workspace-name>/
```

For example, Tech Radar uses `workspaces/tech-radar/`.

The workspace selector is optional so global-only workspaces can run. The
global selector remains required.

## CI Secret Delivery

CI continues to provide secrets through its existing mounted-file and
environment contracts. This package does not change CI secret mounts or read
CI secret-manager values.

## Use in Test Code (Direct Access)

For use in test code (`*.spec.ts`), access secrets directly via `process.env`:

```typescript
test.beforeAll(async ({ rhdh }) => {
  // Direct access - no rhdh-secrets.yaml needed
  const apiKey = process.env.VAULT_API_KEY;

  if (!apiKey) {
    throw new Error("VAULT_API_KEY is not set");
  }

  await rhdh.configure({ auth: "keycloak" });
  await rhdh.deploy();
});
```

## Use in RHDH Configuration Files

To use secret values in `app-config-rhdh.yaml` or `dynamic-plugins.yaml`, you
must first add them to `rhdh-secrets.yaml`.

### Step 1: Add to rhdh-secrets.yaml

**tests/config/rhdh-secrets.yaml:**
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: rhdh-secrets
type: Opaque
stringData:
  # Left side: name to use in app-config
  # Right side: reference to a supplied secret environment variable (with $)
  EXTERNAL_HOST: $VAULT_EXTERNAL_HOST
  MY_PLUGIN_API_KEY: $VAULT_MY_PLUGIN_API_KEY
```

### Step 2: Use in app-config-rhdh.yaml

**tests/config/app-config-rhdh.yaml:**
```yaml
backend:
  reading:
    allow:
      - host: ${EXTERNAL_HOST}
myPlugin:
  apiKey: ${MY_PLUGIN_API_KEY}
```

## Summary

| Where you need it | How to access |
|-------------------|---------------|
| Test code (`*.spec.ts`) | `process.env.VAULT_*` directly |
| RHDH configs | Add to `rhdh-secrets.yaml` first |

## Related Pages

- [CI Pipeline](/overlay/tutorials/ci-pipeline) - CI secret delivery
- [Configuration Files](/overlay/test-structure/configuration-files) - YAML config flow

## Adding a New Workspace to CI

When adding E2E tests to a new workspace:

1. **Add workspace-specific secure notes to the approved collection:**
    ```
    workspaces/<your-workspace>/
    ```

2. **Add secure notes with the `VAULT_` prefix:**
    ```
    VAULT_YOUR_SECRET: <value>
    ```

3. **Reference secrets in your configuration files.**
