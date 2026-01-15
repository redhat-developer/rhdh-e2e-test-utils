# Global Setup

The package includes a global setup function that runs once before all tests. This ensures the testing environment is properly prepared.

## What Global Setup Does

### 1. Binary Validation

Checks that required CLI tools are installed and available:

| Binary | Purpose |
|--------|---------|
| `oc` | OpenShift CLI for cluster operations |
| `kubectl` | Kubernetes CLI (fallback) |
| `helm` | Helm CLI for chart deployments |

If any binary is missing, tests will fail with a clear error message.

### 2. Cluster Router Base

Fetches the OpenShift ingress domain and sets the `K8S_CLUSTER_ROUTER_BASE` environment variable:

```bash
# Example value
K8S_CLUSTER_ROUTER_BASE=apps.cluster-abc123.example.com
```

This is used to construct route URLs for deployed applications.

### 3. Keycloak Deployment

Automatically deploys and configures Keycloak for OIDC authentication:

- Deploys to the `rhdh-keycloak` namespace
- Uses Bitnami Helm chart
- Configures realm, client, groups, and users for RHDH
- Sets all required Keycloak environment variables

**Skip Keycloak Deployment:**

If your tests don't require Keycloak/OIDC authentication:

```bash
SKIP_KEYCLOAK_DEPLOYMENT=true yarn playwright test
```

Or in your `.env` file:

```bash
SKIP_KEYCLOAK_DEPLOYMENT=true
```

## Environment Variables Set by Global Setup

### Cluster Configuration

| Variable | Description |
|----------|-------------|
| `K8S_CLUSTER_ROUTER_BASE` | OpenShift ingress domain |

### Keycloak Configuration (when deployed)

| Variable | Description |
|----------|-------------|
| `KEYCLOAK_BASE_URL` | Keycloak instance URL |
| `KEYCLOAK_REALM` | Configured realm name |
| `KEYCLOAK_CLIENT_ID` | OIDC client ID |
| `KEYCLOAK_CLIENT_SECRET` | OIDC client secret |
| `KEYCLOAK_METADATA_URL` | OIDC discovery URL |
| `KEYCLOAK_LOGIN_REALM` | Login realm name |

## Default Keycloak Configuration

When Keycloak is deployed via global setup, these defaults are applied:

### Realm

| Setting | Value |
|---------|-------|
| Realm name | `rhdh` |

### Client

| Setting | Value |
|---------|-------|
| Client ID | `rhdh-client` |
| Client Secret | `rhdh-client-secret` |
| Standard flow | Enabled |
| Implicit flow | Enabled |
| Direct access grants | Enabled |
| Service accounts | Enabled |

### Groups

- `developers`
- `admins`
- `viewers`

### Users

| Username | Password | Groups |
|----------|----------|--------|
| `test1` | `test1@123` | developers |
| `test2` | `test2@123` | developers |

## Global Setup Behavior

### Existing Keycloak

If Keycloak is already running in the `rhdh-keycloak` namespace:

- Deployment is skipped
- Existing Keycloak is reused
- Environment variables are still set

### CI vs Local

| Environment | Behavior |
|-------------|----------|
| CI (`CI=true`) | Full setup, resources cleaned up after |
| Local | Setup runs, resources preserved for debugging |

## Customizing Global Setup

The global setup is automatically included when using `defineConfig`. To skip it entirely:

```typescript
import { baseConfig } from "rhdh-e2e-test-utils/playwright-config";
import { defineConfig } from "@playwright/test";

export default defineConfig({
  ...baseConfig,
  globalSetup: undefined, // Disable global setup
  projects: [{ name: "my-plugin" }],
});
```

## Troubleshooting

### Binary Not Found

```
Error: Required binary 'helm' not found in PATH
```

**Solution:** Install the missing binary and ensure it's in your PATH.

### Cluster Connection Failed

```
Error: Unable to connect to cluster
```

**Solution:** Verify you're logged into the OpenShift cluster:

```bash
oc whoami
oc cluster-info
```

### Keycloak Deployment Failed

```
Error: Keycloak deployment timed out
```

**Solution:**
1. Check cluster resources are available
2. Check PersistentVolumeClaims can be created
3. Manually check the `rhdh-keycloak` namespace for errors

```bash
oc get pods -n rhdh-keycloak
oc describe pod -n rhdh-keycloak keycloak-0
```
