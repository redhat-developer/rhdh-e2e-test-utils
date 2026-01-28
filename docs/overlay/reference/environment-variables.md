# Environment Variables

::: tip Overlay Documentation
This page covers writing tests within rhdh-plugin-export-overlays.
For using rhdh-e2e-test-utils in external projects, see the [Guide](/guide/).
:::

This page documents all environment variables used in overlay E2E tests.

## Vault Secrets (VAULT_*)

In OpenShift CI, secrets are managed through [HashiCorp Vault](https://vault.ci.openshift.org) and automatically exported as environment variables.

All secrets **must** start with the `VAULT_` prefix (e.g., `VAULT_API_KEY`, `VAULT_GITHUB_TOKEN`).

For complete Vault setup instructions including paths, annotations, and access requests, see [OpenShift CI Pipeline - Vault Secrets](/overlay/tutorials/ci-pipeline#vault-secrets).

## Core Variables

### RHDH Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `RHDH_VERSION` | RHDH version to deploy (e.g., "1.5", "next") | `next` | No |
| `INSTALLATION_METHOD` | Deployment method: `helm` or `operator` | `helm` | No |
| `CHART_URL` | Custom Helm chart URL | `oci://quay.io/rhdh/chart` | No |

### Cluster Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `K8S_CLUSTER_ROUTER_BASE` | Cluster router base domain | Auto-detected | No |

### Authentication

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `SKIP_KEYCLOAK_DEPLOYMENT` | Skip Keycloak deployment entirely (useful for guest auth) | `false` | No |

::: tip Keycloak Deployment Behavior
By default (`SKIP_KEYCLOAK_DEPLOYMENT=false`):
- If Keycloak already exists in the cluster, it uses the existing instance
- If Keycloak doesn't exist, it deploys a new one

Set `SKIP_KEYCLOAK_DEPLOYMENT=true` when using guest authentication and you don't need Keycloak at all.
:::

### CI/CD

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `CI` | Set automatically in CI environments | `false` | No |

## Plugin Metadata Variables

These control automatic plugin configuration generation from metadata files:

| Variable | Description | Effect |
|----------|-------------|--------|
| `GIT_PR_NUMBER` | PR number | Enables OCI URL generation using that PR's built images |
| `RHDH_SKIP_PLUGIN_METADATA_INJECTION` | When set (any value), disables metadata injection | Opt-out for all metadata handling |
| `JOB_NAME` | CI job name (set by OpenShift CI/Prow) | If contains `periodic-`, injection is disabled |

### When to Use These Variables

| Scenario | Variables to Set |
|----------|------------------|
| PR builds in CI | `GIT_PR_NUMBER` is set automatically |
| Test PR builds locally | Set `GIT_PR_NUMBER` manually to use PR's OCI images |
| Nightly/periodic builds | `JOB_NAME` contains `periodic-` (auto-detected) |
| Manual opt-out | Set `RHDH_SKIP_PLUGIN_METADATA_INJECTION=true` |

### Metadata Handling Behavior

**Enabled by default** for:
- Local development
- PR builds in CI

**Disabled automatically** when:
- `RHDH_SKIP_PLUGIN_METADATA_INJECTION` is set (any value)
- `JOB_NAME` contains `periodic-` (nightly builds)

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

| Where you need it | How to access |
|-------------------|---------------|
| Test code (`*.spec.ts`) | `process.env.VAULT_*` directly |
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
test.beforeAll(async ({ rhdh }) => {
  const requiredVars = ["VAULT_API_KEY", "VAULT_SECRET"];
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      throw new Error(`Required variable ${varName} is not set`);
    }
  }

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
