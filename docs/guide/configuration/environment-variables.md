# Environment Variables

Complete reference of all environment variables used by the package.

## Recommended Variables

These are optional but commonly set to control deployment behavior:

| Variable | Description | Example | Default |
|----------|-------------|---------|---------|
| `RHDH_VERSION` | RHDH version to deploy | `"1.5"` | `"next"` |
| `INSTALLATION_METHOD` | Deployment method | `"helm"` or `"operator"` | `"helm"` |

## Auto-Generated Variables

These are set automatically during deployment:

| Variable | Description | Set By |
|----------|-------------|--------|
| `K8S_CLUSTER_ROUTER_BASE` | OpenShift ingress domain | Global setup |
| `RHDH_BASE_URL` | Full RHDH URL | RHDHDeployment |

## Playwright Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PLAYWRIGHT_WORKERS` | Number of parallel workers (e.g., `"4"`, `"50%"`) | `"50%"` |
| `PLAYWRIGHT_RETRIES` | Number of test retries on failure | `0` |

## Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CI` | Enables auto-cleanup | - |
| `CHART_URL` | Custom Helm chart URL | `oci://quay.io/rhdh/chart` |
| `SKIP_KEYCLOAK_DEPLOYMENT` | Skip Keycloak auto-deploy | `false` |
| `RHDH_SKIP_PLUGIN_METADATA_INJECTION` | Disable plugin metadata injection | - |

## Plugin Metadata Variables

These control automatic plugin configuration injection from metadata files:

| Variable | Description | Effect |
|----------|-------------|--------|
| `GIT_PR_NUMBER` | PR number (set by OpenShift CI) | Enables OCI URL generation for PR builds |
| `E2E_NIGHTLY_MODE` | When `"true"`, activates nightly mode | Uses released OCI refs, skips metadata injection |
| `RHDH_SKIP_PLUGIN_METADATA_INJECTION` | When `"true"`, disables metadata injection | Opt-out |
| `JOB_NAME` | CI job name (set by OpenShift CI/Prow) | If contains `periodic-`, injection is disabled |
| `JOB_MODE` | CI-only: `nightly` or `pr-check` (set by step registry) | Informational |

### OCI URL Generation

When `GIT_PR_NUMBER` is set, the package replaces local plugin paths with OCI URLs:

```yaml
# Before
- package: ./dynamic-plugins/dist/my-plugin

# After (with GIT_PR_NUMBER=1234)
- package: oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/my-plugin:pr_1234__1.0.0
```

See [Plugin Metadata](/guide/utilities/plugin-metadata#oci-url-generation-for-pr-builds) for complete details.

## Keycloak Variables

Required when using `auth: "keycloak"`:

| Variable | Description |
|----------|-------------|
| `KEYCLOAK_BASE_URL` | Keycloak instance URL |
| `KEYCLOAK_REALM` | Realm name |
| `KEYCLOAK_CLIENT_ID` | OIDC client ID |
| `KEYCLOAK_CLIENT_SECRET` | OIDC client secret |
| `KEYCLOAK_METADATA_URL` | OIDC discovery URL |
| `KEYCLOAK_LOGIN_REALM` | Login realm name |
| `KEYCLOAK_USER_NAME` | Default test username |
| `KEYCLOAK_USER_PASSWORD` | Default test password |

These are automatically set by `KeycloakHelper.configureForRHDH()`.

## GitHub Variables

For GitHub integration:

| Variable | Description | Required |
|----------|-------------|----------|
| `VAULT_GITHUB_USER_TOKEN` | GitHub personal access token | For API/auth |
| `VAULT_GH_USER_NAME` | GitHub username | For login |
| `VAULT_GH_USER_PASSWORD` | GitHub password | For login |
| `VAULT_GH_2FA_SECRET` | 2FA secret for OTP | For login |

## Custom Variables

Use in configuration files:

```yaml
# tests/config/app-config-rhdh.yaml
myPlugin:
  apiUrl: ${MY_PLUGIN_API_URL}
  apiKey: ${MY_PLUGIN_API_KEY:-default-key}
```

```yaml
# tests/config/rhdh-secrets.yaml
stringData:
  MY_PLUGIN_API_KEY: ${MY_PLUGIN_API_KEY}
```

## Setting Variables

### .env File

Create `.env` in your project root:

```bash
RHDH_VERSION="1.5"
INSTALLATION_METHOD="helm"
SKIP_KEYCLOAK_DEPLOYMENT=false

# Secrets
GITHUB_TOKEN=ghp_xxxxx
MY_API_KEY=secret-value
```

Load with dotenv:

```typescript
// playwright.config.ts
import dotenv from "dotenv";
dotenv.config({ path: `${import.meta.dirname}/.env` });
```

### CI/CD

Set in your CI pipeline:

```yaml
# GitHub Actions
env:
  RHDH_VERSION: "1.5"
  INSTALLATION_METHOD: "helm"
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Runtime

Set programmatically:

```typescript
test.beforeAll(async ({ rhdh }) => {
  process.env.MY_CUSTOM_URL = await rhdh.k8sClient.getRouteLocation(
    rhdh.deploymentConfig.namespace,
    "my-service"
  );

  await rhdh.deploy();
});
```

## Variable Precedence

1. Runtime (`process.env`)
2. CI/CD environment
3. `.env` file
4. Default values (`${VAR:-default}`)
