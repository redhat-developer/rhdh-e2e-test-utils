# OpenShift CI Pipeline

::: tip Overlay Documentation
This page covers writing tests within rhdh-plugin-export-overlays.
For using rhdh-e2e-test-utils in external projects, see the [Guide](/guide/).
:::

This tutorial explains how E2E tests integrate with the OpenShift CI pipeline in the overlay repository.

## Overview

E2E tests in the overlay repository run automatically via OpenShift CI when:
- Pull requests are opened or updated
- Changes are pushed to the main branch

The CI system automatically:
- Builds OCI images from PR changes (via `/publish` command)
- Deploys RHDH to an OpenShift cluster using those images
- Runs the E2E tests
- Reports results on the PR

## PR OCI Image Builds

When testing a PR, the plugins need to be built into OCI images that RHDH can use. This is handled through the `/publish` command.

### The /publish Command

To build OCI images from your PR, add this comment to your PR:

```
/publish
```

This triggers a workflow that:
1. Builds the plugins in your PR
2. Pushes OCI images to `ghcr.io/redhat-developer/rhdh-plugin-export-overlays`
3. Tags images with `pr_{PR_NUMBER}__{version}` format

### Automatic OCI URL Replacement

When `GIT_PR_NUMBER` is set (in CI or locally):

1. The package reads `source.json` and `plugins-list.yaml`
2. Fetches plugin versions from the source repo's `package.json` files
3. Replaces plugin paths with OCI URLs automatically

**In CI:** This happens automatically for all PR test runs. It doesn't matter what package format you use in your configuration - it will be replaced with the PR's OCI images.

**Locally:** You can test PR builds by setting `GIT_PR_NUMBER`:

```bash
# Test locally using PR 1845's published OCI images
export GIT_PR_NUMBER=1845
yarn test
```

### What You Don't Need to Do

The OCI URL replacement is **automatic**. You don't need to:
- Specify OCI URLs in your configuration files
- Handle different configurations for local vs CI
- Modify any files after running `/publish`

### Required Files for OCI Generation

These files must exist in the workspace root when `GIT_PR_NUMBER` is set:

| File | Content |
|------|---------|
| `source.json` | `{"repo": "...", "repo-ref": "commit-sha"}` |
| `plugins-list.yaml` | List of plugin paths (e.g., `plugins/tech-radar:`) |

In CI, these are generated automatically. For local testing with `GIT_PR_NUMBER`, you may need to copy them from a CI run.

::: warning Strict Validation
OCI URL generation is strict - deployment will fail if required files are missing or version fetching fails. This prevents builds from silently falling back to local paths.
:::

## Vault Secrets

Secrets are managed through [HashiCorp Vault](https://vault.ci.openshift.org) and automatically exported as environment variables during CI execution.

### Secret Naming Convention

All secrets **must** start with the `VAULT_` prefix:

```
VAULT_MY_SECRET_NAME
VAULT_GITHUB_TOKEN
VAULT_API_KEY
```

This prefix differentiates secrets from Vault and ensures they are automatically exported during CI execution.

### Global Secrets

Global secrets are available to **all** workspace tests. Use these for common secrets shared across multiple plugins.

**Vault Path:** [Global Secrets](https://vault.ci.openshift.org/ui/vault/secrets/kv/kv/selfservice%2Frhdh-plugin-export-overlays%2Fglobal/details)

### Workspace-Specific Secrets

Secrets that are only needed for a specific plugin workspace should be stored in the workspace-specific path.

**Example for tech-radar workspace:** [Tech Radar Secrets](https://vault.ci.openshift.org/ui/vault/secrets/kv/kv/selfservice%2Frhdh-plugin-export-overlays%2Fworkspaces%2Ftech-radar/details)

**Pattern:**
```
selfservice/rhdh-plugin-export-overlays/workspaces/<workspace-name>
```

### Required Vault Annotations

Each workspace-specific secret path must include these annotations for OpenShift CI to automatically import the secrets:

```json
{
  "secretsync/target-name": "rhdh-plugin-export-overlays",
  "secretsync/target-namespace": "test-credentials"
}
```

### Requesting Vault Access

If you don't have access to the Vault, reach out in the team-rhdh channel to request access.

## Using Vault Secrets

There are two ways to use Vault secrets, depending on where you need them:

### In Test Code (Direct Access)

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

### In RHDH Configuration Files

To use Vault secrets in `app-config-rhdh.yaml` or `dynamic-plugins.yaml`, you must first add them to `rhdh-secrets.yaml`:

#### Step 1: Add to rhdh-secrets.yaml

**tests/config/rhdh-secrets.yaml:**
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: rhdh-secrets
type: Opaque
stringData:
  # Left side: name to use in app-config
  # Right side: reference to Vault secret (with $)
  EXTERNAL_HOST: $VAULT_EXTERNAL_HOST
  MY_PLUGIN_API_KEY: $VAULT_MY_PLUGIN_API_KEY
```

#### Step 2: Use in app-config-rhdh.yaml

**tests/config/app-config-rhdh.yaml:**
```yaml
backend:
  reading:
    allow:
      - host: ${EXTERNAL_HOST}
myPlugin:
  apiKey: ${MY_PLUGIN_API_KEY}
```

### Summary

| Where you need it | How to access |
|-------------------|---------------|
| Test code (`*.spec.ts`) | `process.env.VAULT_*` directly |
| RHDH configs | Add to `rhdh-secrets.yaml` first |

See [Configuration Files - rhdh-secrets.yaml](/overlay/test-structure/configuration-files#rhdh-secrets-yaml-optional) for more details on the secrets flow.

## Adding a New Workspace to CI

When adding E2E tests to a new workspace:

1. **Create workspace-specific secret path in Vault:**
   ```
   selfservice/rhdh-plugin-export-overlays/workspaces/<your-workspace>
   ```

2. **Add required annotations:**
   ```json
   {
     "secretsync/target-name": "rhdh-plugin-export-overlays",
     "secretsync/target-namespace": "test-credentials"
   }
   ```

3. **Add secrets with `VAULT_` prefix:**
   ```
   VAULT_YOUR_SECRET: <value>
   ```

4. **Reference secrets in your configuration files**

## CI Environment Variables

The following environment variables are available during CI execution:

| Variable | Description |
|----------|-------------|
| `K8S_CLUSTER_ROUTER_BASE` | Cluster router base domain |
| `RHDH_VERSION` | RHDH version to deploy |
| `INSTALLATION_METHOD` | `helm` or `operator` |
| `CI` | Set to `true` in CI environment |
| `GIT_PR_NUMBER` | PR number (enables OCI URL generation) |
| `JOB_NAME` | CI job name (if contains `periodic-`, disables metadata) |
| `VAULT_*` | All Vault secrets with this prefix |

### Plugin Metadata Variables

| Variable | Effect |
|----------|--------|
| `GIT_PR_NUMBER` | Enables OCI URL generation for PR builds |
| `RHDH_SKIP_PLUGIN_METADATA_INJECTION` | Disables all metadata handling |
| `JOB_NAME` | If contains `periodic-`, disables metadata handling |

See [Environment Variables Reference](/overlay/reference/environment-variables#plugin-metadata-variables) for details.

## Configuration Behavior in CI

::: tip Best Practice
**Don't create `dynamic-plugins.yaml`**. The package auto-generates configuration from plugin metadata, which means all plugins in the workspace are enabled by default. For PR builds, local paths are automatically replaced with OCI URLs.
:::

See [Configuration Files](/overlay/test-structure/configuration-files) for complete details on:
- [All configuration files are optional](/overlay/test-structure/configuration-files#all-configuration-files-are-optional)
- [How dynamic-plugins.yaml auto-generation works](/overlay/test-structure/configuration-files#dynamic-plugins-yaml-optional)
- [Configuration merge order](/overlay/test-structure/configuration-files#configuration-merging)

## Debugging CI Failures

### View CI Logs

CI logs are available on the PR. Look for:
- Deployment logs
- Test execution output
- Screenshots and traces (uploaded as artifacts)

### Common CI Issues

**Secrets not available:**
- Verify the secret has `VAULT_` prefix
- Check Vault path has correct annotations
- Ensure you have access to the Vault path

**Deployment timeout:**
- Check cluster resources
- Verify RHDH version is valid
- Review deployment logs for errors

**Tests pass locally but fail in CI:**
- Check for hardcoded values that work locally
- Verify all required secrets are in Vault
- Ensure env vars are properly prefixed with `VAULT_`

## Local Testing Before CI

Before pushing to CI, test locally:

```bash
cd workspaces/<plugin>/e2e-tests

# Set required Vault secrets locally
export VAULT_MY_SECRET="local-value"

# Run tests
yarn test
```

## Related Pages

- [Running Tests Locally](./running-locally) - Local development workflow
- [Environment Variables](/overlay/reference/environment-variables) - All supported variables
- [Configuration Files](/overlay/test-structure/configuration-files) - YAML configuration
- [Troubleshooting](/overlay/reference/troubleshooting) - Common issues
