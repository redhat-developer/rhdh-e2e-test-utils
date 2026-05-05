# Environment Variables

::: tip Overlay Documentation
This page covers writing tests within rhdh-plugin-export-overlays.
For using @red-hat-developer-hub/e2e-test-utils in external projects, see the [Guide](/guide/).
:::

This page documents all environment variables used in overlay E2E tests.

## Vault Secrets (VAULT\_\*)

In OpenShift CI, secrets are managed through [HashiCorp Vault](https://vault.ci.openshift.org) and automatically exported as environment variables.

All secrets **must** start with the `VAULT_` prefix (e.g., `VAULT_API_KEY`, `VAULT_GITHUB_TOKEN`).

For complete Vault setup instructions including paths, annotations, and access requests, see [OpenShift CI Pipeline - Vault Secrets](/overlay/tutorials/ci-pipeline#vault-secrets).

## Vault Auto-Loading (Local Development)

Set `VAULT=1` or `VAULT=true` to automatically fetch secrets from Vault during global setup. This replaces the need to manually copy secrets into `.env` files.

| Variable          | Description                           | Default                                   |
| ----------------- | ------------------------------------- | ----------------------------------------- |
| `VAULT`           | Enable automatic Vault secret loading | -                                         |
| `VAULT_ADDR`      | Vault server URL                      | `https://vault.ci.openshift.org`          |
| `VAULT_BASE_PATH` | Base path in Vault KV store           | `selfservice/rhdh-plugin-export-overlays` |

```bash
VAULT=1 yarn test
VAULT=1 ./run-e2e.sh -w argocd
```

See [Running Locally - Secrets from Vault](/overlay/tutorials/running-locally#secrets-from-vault) for full details.

## Core Variables

### RHDH Configuration

| Variable              | Description                                  | Default                    | Required |
| --------------------- | -------------------------------------------- | -------------------------- | -------- |
| `RHDH_VERSION`        | RHDH version to deploy (e.g., "1.5", "next") | `next`                     | No       |
| `INSTALLATION_METHOD` | Deployment method: `helm` or `operator`      | `helm`                     | No       |
| `CHART_URL`           | Custom Helm chart URL                        | `oci://quay.io/rhdh/chart` | No       |

### New frontend system (app-next / NFS)

When the new frontend system is active (see [`useNewFrontendSystem`](/guide/deployment/rhdh-deployment#new-frontend-system-usenewfrontendsystem) and [environment variables](/guide/configuration/environment-variables#new-frontend-system-app-next)), the package merges NFS defaults then your workspace files. Pin **app-auth** / **app-integrations** OCI refs in `tests/config/dynamic-plugins.yaml` like any other plugin (your file wins over package defaults).

| Variable | Description |
|----------|-------------|
| `USE_NEW_FRONTEND_SYSTEM` | When `"true"`, enables NFS merges if `useNewFrontendSystem` is not set in `configure()` options |

### Cluster Configuration

| Variable                  | Description                | Default       | Required |
| ------------------------- | -------------------------- | ------------- | -------- |
| `K8S_CLUSTER_ROUTER_BASE` | Cluster router base domain | Auto-detected | No       |

### Authentication

| Variable                   | Description                                               | Default | Required |
| -------------------------- | --------------------------------------------------------- | ------- | -------- |
| `SKIP_KEYCLOAK_DEPLOYMENT` | Skip Keycloak deployment entirely (useful for guest auth) | `false` | No       |

::: tip Keycloak Deployment Behavior
By default (`SKIP_KEYCLOAK_DEPLOYMENT=false`):

- If Keycloak already exists in the cluster, it uses the existing instance
- If Keycloak doesn't exist, it deploys a new one

Set `SKIP_KEYCLOAK_DEPLOYMENT=true` when using guest authentication and you don't need Keycloak at all.
:::

### CI/CD

| Variable   | Description                                      | Default | Required |
| ---------- | ------------------------------------------------ | ------- | -------- |
| `CI`       | Set automatically in CI environments             | `false` | No       |
| `JOB_MODE` | Set by CI step registry: `nightly` or `pr-check` | -       | No       |

## Plugin Metadata Variables

These control automatic plugin configuration generation from metadata files.

> **DPDY** refers to `dynamic-plugins.default.yaml` in the catalog index image shipped with RHDH. The list of DPDY packages is defined in [`default.packages.yaml`](https://github.com/redhat-developer/rhdh/blob/main/default.packages.yaml).

| Variable                              | Description                              | Effect                                                                                                                                                                                   |
| ------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GIT_PR_NUMBER`                       | PR number                                | Enables OCI URL generation using that PR's built images                                                                                                                                  |
| `E2E_NIGHTLY_MODE`                    | When `true`, activates nightly mode      | Plugins in `default.packages.yaml` with OCI metadata use `{{inherit}}` (RHDH resolves both OCI tag and config from DPDY); other OCI plugins use full metadata refs with config injection |
| `RELEASE_BRANCH_NAME`                 | Release branch (set by OpenShift CI)     | Used to fetch `default.packages.yaml` for DPDY resolution. Required in CI, defaults to `main` locally                                                                                    |
| `NIGHTLY_DPDY_OCI_REGISTRY`           | OCI registry for `{{inherit}}` refs      | Overrides default `registry.access.redhat.com/rhdh` for all plugins using `{{inherit}}` in nightly mode                                                                                  |
| `NIGHTLY_DPDY_OCI_REGISTRY_MAP`       | JSON: `{"registry": ["pkg1", "pkg2"]}`   | Per-plugin registry override (takes precedence over blanket)                                                                                                                             |
| `RHDH_SKIP_PLUGIN_METADATA_INJECTION` | When `true`, disables metadata injection | Local-only opt-out (ignored when `CI=true`)                                                                                                                                              |
| `JOB_NAME`                            | CI job name (set by OpenShift CI/Prow)   | If contains `periodic-`, nightly mode is activated                                                                                                                                       |

### When to Use These Variables

| Scenario                    | Variables to Set                                                                 |
| --------------------------- | -------------------------------------------------------------------------------- |
| PR builds in CI             | `GIT_PR_NUMBER` is set automatically                                             |
| Test PR builds locally      | Set `GIT_PR_NUMBER` manually to use PR's OCI images                              |
| Nightly/periodic builds     | `E2E_NIGHTLY_MODE=true` or `JOB_NAME` contains `periodic-` (auto-detected in CI) |
| Manual opt-out (local only) | Set `RHDH_SKIP_PLUGIN_METADATA_INJECTION=true` (ignored in CI)                   |

### Metadata Handling Behavior

**Enabled by default** for:

- Local development
- PR builds in CI

**Disabled locally** when:

- `RHDH_SKIP_PLUGIN_METADATA_INJECTION` is set to `true` (ignored in CI)

**Selective in nightly mode** (`E2E_NIGHTLY_MODE=true` or `JOB_NAME` contains `periodic-`):

- Plugins in `default.packages.yaml` with OCI metadata: no injection (use `{{inherit}}` tag — RHDH resolves both the OCI tag and default config from its built-in DPDY)
- Plugins NOT in `default.packages.yaml` with OCI metadata: injection enabled (full metadata refs, config from `appConfigExamples`)
- Wrapper plugins: no injection

::: info Priority
When `GIT_PR_NUMBER` is set, PR mode always takes precedence over nightly mode. This prevents broken combinations of PR images with nightly configuration.
:::

### OCI URL Generation

When `GIT_PR_NUMBER` is set (in CI or locally):

1. Package reads `source.json` from workspace root for repo and commit ref
2. Package reads `plugins-list.yaml` for plugin paths
3. For each plugin, fetches `package.json` from source repo to get version
4. Generates OCI URLs in format:
   ```
   oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/{plugin-name}:pr_{PR_NUMBER}__{version}
   ```

**This works both in CI and locally.** To test a PR's published OCI images locally:

```bash
export GIT_PR_NUMBER=1845
yarn test
```

Example transformation:

```yaml
# Without GIT_PR_NUMBER
- package: ./dynamic-plugins/dist/backstage-community-plugin-tech-radar

# With GIT_PR_NUMBER=1845
- package: oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/backstage-community-plugin-tech-radar:pr_1845__1.13.0
```

See [Configuration Files - PR Builds](/overlay/test-structure/configuration-files#pr-builds-and-oci-images) for details.

## Test Runner Variables

These are used by `run-e2e.sh` (the [unified test runner](/overlay/reference/run-e2e)):

| Variable                 | Description                                             | Default                             |
| ------------------------ | ------------------------------------------------------- | ----------------------------------- |
| `E2E_TEST_UTILS_PATH`    | Absolute path to a local `e2e-test-utils` build         | -                                   |
| `E2E_TEST_UTILS_VERSION` | Pin `@red-hat-developer-hub/e2e-test-utils` npm version | `latest` (nightly), empty otherwise |
| `PLAYWRIGHT_VERSION`     | Pin `@playwright/test` version                          | `1.59.1`                            |

::: tip Version Pinning
`E2E_TEST_UTILS_PATH` takes precedence over `E2E_TEST_UTILS_VERSION`. If neither is set, the version in each workspace's `package.json` is used.

In nightly mode (`E2E_NIGHTLY_MODE=true`), `E2E_TEST_UTILS_VERSION` defaults to `latest`.
:::

## Setting Variables

### In .env File (Local Development)

Create `.env` in your `e2e-tests/` directory:

```bash
# .env
RHDH_VERSION=1.5
INSTALLATION_METHOD=helm
SKIP_KEYCLOAK_DEPLOYMENT=false

# Vault secrets for local testing
VAULT_MY_SECRET=local-test-value
VAULT_GITHUB_TOKEN=ghp_xxx
```

### In Test Code

Set dynamically in `beforeAll`:

```typescript
test.beforeAll(async ({ rhdh }) => {
  // Set before deployment
  process.env.MY_SERVICE_URL = "https://example.com";

  await rhdh.configure({ auth: "keycloak" });
  await rhdh.deploy();
});
```

### In Vault (CI)

Add secrets to the appropriate Vault path with `VAULT_` prefix:

```
VAULT_MY_SECRET: secret-value
VAULT_API_KEY: api-key-value
```

## Using Variables

| Where you need it                                             | How to access                                            |
| ------------------------------------------------------------- | -------------------------------------------------------- |
| Test code (`*.spec.ts`)                                       | `process.env.VAULT_*` directly                           |
| RHDH configs (`app-config-rhdh.yaml`, `dynamic-plugins.yaml`) | Add to `rhdh-secrets.yaml` first, then use `${VAR_NAME}` |

For detailed examples, see [Configuration Files - rhdh-secrets.yaml](/overlay/test-structure/configuration-files#rhdh-secrets-yaml-optional).

### Fallback Values

Use `${VAR:-default}` syntax in YAML configs:

```yaml
app:
  title: ${APP_TITLE:-RHDH Test Instance}
```

## Variable Scope

### Worker-Scoped

Variables set in `beforeAll` are available to all tests in that worker:

```typescript
test.beforeAll(async ({ rhdh }) => {
  process.env.SERVICE_URL = "https://example.com";
  // Available to all tests in this worker
});
```

### Test-Scoped

Variables set in individual tests are only available in that test:

```typescript
test("my test", async () => {
  process.env.TEMP_VAR = "value";
  // Only available in this test
});
```

## Common Patterns

### Dynamic Service URL

```typescript
test.beforeAll(async ({ rhdh }) => {
  const project = rhdh.deploymentConfig.namespace;

  // Deploy service
  await $`bash ${setupScript} ${project}`;

  // Get URL and set as env var
  const url = await rhdh.k8sClient.getRouteLocation(project, "my-service");
  process.env.MY_SERVICE_URL = url.replace("http://", "");

  await rhdh.configure({ auth: "keycloak" });
  await rhdh.deploy();
});
```

### Validating Required Variables

```typescript
import { requireEnv } from "@red-hat-developer-hub/e2e-test-utils/utils";

test.beforeAll(async ({ rhdh }) => {
  requireEnv("VAULT_API_KEY", "VAULT_SECRET");

  await rhdh.configure({ auth: "keycloak" });
  await rhdh.deploy();
});
```

### Conditional Configuration

```typescript
test.beforeAll(async ({ rhdh }) => {
  const auth = process.env.USE_GUEST_AUTH === "true" ? "guest" : "keycloak";
  await rhdh.configure({ auth });
  await rhdh.deploy();
});
```

## Debugging Variables

### Log Variables

```typescript
test.beforeAll(async ({ rhdh }) => {
  console.log("RHDH_VERSION:", process.env.RHDH_VERSION);
  console.log("INSTALLATION_METHOD:", process.env.INSTALLATION_METHOD);
  // Don't log actual secret values!
  console.log("VAULT_API_KEY set:", !!process.env.VAULT_API_KEY);
});
```

## Related Pages

- [OpenShift CI Pipeline](/overlay/tutorials/ci-pipeline) - CI/CD setup
- [Configuration Files](/overlay/test-structure/configuration-files) - Using variables in YAML
- [Running Locally](/overlay/tutorials/running-locally) - Local development
