# Global Setup

Pre-test setup function that runs before all tests.

## Behavior

The global setup performs:

1. **Binary Validation** - Checks `oc`, `kubectl`, `helm` are installed
2. **Cluster Configuration** - Fetches ingress domain
3. **Keycloak Deployment** - Deploys Keycloak (unless skipped)

## Environment Variables Set

| Variable | Description |
|----------|-------------|
| `K8S_CLUSTER_ROUTER_BASE` | OpenShift ingress domain |
| `KEYCLOAK_BASE_URL` | Keycloak URL (if deployed) |
| `KEYCLOAK_REALM` | Realm name (if deployed) |
| `KEYCLOAK_CLIENT_ID` | Client ID (if deployed) |
| `KEYCLOAK_CLIENT_SECRET` | Client secret (if deployed) |
| `KEYCLOAK_METADATA_URL` | OIDC discovery URL (if deployed) |
| `KEYCLOAK_LOGIN_REALM` | Login realm (if deployed) |

## Skipping Keycloak

```bash
SKIP_KEYCLOAK_DEPLOYMENT=true yarn playwright test
```

## Default Keycloak Configuration

When deployed:

- **Namespace:** `rhdh-keycloak`
- **Realm:** `rhdh`
- **Client:** `rhdh-client`
- **Users:** `test1`, `test2`

## Disabling Global Setup

```typescript
import { baseConfig } from "rhdh-e2e-test-utils/playwright-config";
import { defineConfig } from "@playwright/test";

export default defineConfig({
  ...baseConfig,
  globalSetup: undefined, // Disable
  projects: [{ name: "my-plugin" }],
});
```

## Custom Global Setup

Create your own that calls the default:

```typescript
// global-setup.ts
import { globalSetup as defaultSetup } from "rhdh-e2e-test-utils/playwright-config";

export default async function globalSetup() {
  // Your custom setup
  console.log("Custom setup starting...");

  // Call default setup
  await defaultSetup();

  // More custom setup
  console.log("Custom setup complete");
}
```

```typescript
// playwright.config.ts
import { defineConfig } from "rhdh-e2e-test-utils/playwright-config";

export default defineConfig({
  globalSetup: require.resolve("./global-setup"),
  projects: [{ name: "my-plugin" }],
});
```
