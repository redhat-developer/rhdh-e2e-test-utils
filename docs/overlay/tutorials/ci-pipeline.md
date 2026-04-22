# OpenShift CI Pipeline

::: tip Overlay Documentation
This page covers writing tests within rhdh-plugin-export-overlays.
For using @red-hat-developer-hub/e2e-test-utils in external projects, see the [Guide](/guide/).
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

## e2e-ocp-helm Job

The `e2e-ocp-helm` job runs Helm-based E2E tests on an OpenShift cluster.

### When It Runs

- Automatically after `/publish` completes successfully (and the workspace contains `e2e-tests`)
- Manually via PR comment:

```
/test e2e-ocp-helm
```

### Where to Find the Playwright Report

1. Open the **ci/prow/e2e-ocp-helm** check on the PR
2. Navigate to the Prow job page
3. Open:

```
artifacts/e2e-ocp-helm/redhat-developer-rhdh-plugin-export-overlays-ocp-helm/artifacts/playwright-report/index.html
```

## e2e-ocp-helm-nightly Job

The `e2e-ocp-helm-nightly` job runs E2E tests against **released** OCI images across all workspaces, verifying that published plugins work correctly with the current RHDH version.

### When It Runs

- **Daily cron**: 4 AM UTC
- **Manually** via PR comment: `/test e2e-ocp-helm-nightly`
- **Rehearse** via release repo PRs

### How It Differs from PR Check

| Aspect | PR Check (`e2e-ocp-helm`) | Nightly (`e2e-ocp-helm-nightly`) |
|--------|--------------------------|----------------------------------|
| **JOB_MODE** | `pr-check` | `nightly` |
| **GIT_PR_NUMBER** | Set (PR number) | Not exported |
| **OCI Images** | PR-built (`pr_` tags) for workspace plugins | Released (from metadata `spec.dynamicArtifact`) |
| **Metadata injection** | Yes — `appConfigExamples` merged | Skipped |
| **Wrapper disabling** | Yes (`disableWrappers`) | No |
| **Workspaces Tested** | Changed workspace only | All workspaces |
| **E2E_NIGHTLY_MODE** | Not set | `true` |

::: info Why Released OCI Images?
Nightly tests use OCI refs from workspace metadata (`spec.dynamicArtifact`) because metadata files are the most accurate source for latest published plugin versions — updated daily by the `update-plugins-repo-refs` workflow. Many plugins are not in the catalog index, and those that are may have older versions.
:::

### JOB_MODE

The CI step registry determines `JOB_MODE` early and uses it to drive all downstream behavior:

- **`nightly`**: Periodic cron jobs, or presubmit jobs with `nightly` in the name
- **`pr-check`**: All other presubmit jobs

`GIT_PR_NUMBER` is only parsed and exported in `pr-check` mode, preventing nightly jobs from accidentally resolving PR-specific OCI images.

### Where to Find the Playwright Report

Same as the pr-check job:

```
artifacts/e2e-ocp-helm-nightly/redhat-developer-rhdh-plugin-export-overlays-ocp-helm/artifacts/playwright-report/index.html
```

### Rehearsing the Nightly Job

To test nightly job changes via the release repo:

1. Open a PR in the release repo with your step registry changes
2. Comment `/test e2e-ocp-helm-nightly` on the PR
3. The rehearse job runs with `JOB_MODE=nightly`, testing all workspaces

## Skipping Tests by CI Job

Tests can opt out of specific CI jobs using Playwright tags. The `run-e2e.sh` script auto-derives a skip tag from `JOB_NAME` and passes `--grep-invert` to Playwright.

For example, to skip a test in the nightly helm job:

```typescript
test.describe("My Plugin", { tag: "@skip-ocp-helm-nightly" }, () => {
  // This entire suite is excluded when JOB_NAME contains "e2e-ocp-helm-nightly"
});
```

### Available Tags

| Tag | Skipped in | Not skipped in |
|-----|-----------|----------------|
| `@skip-ocp-helm` | `e2e-ocp-helm` (PR check) | `e2e-ocp-helm-nightly` |
| `@skip-ocp-helm-nightly` | `e2e-ocp-helm-nightly` | `e2e-ocp-helm` (PR check) |
| `@skip-ocp-operator` | `e2e-ocp-operator` (PR check) | `e2e-ocp-operator-nightly` |
| `@skip-ocp-operator-nightly` | `e2e-ocp-operator-nightly` | `e2e-ocp-operator` (PR check) |

Each tag matches exactly — `@skip-ocp-helm` won't accidentally skip tests in the nightly job.

Multiple tags can be combined on a single test or describe block:

```typescript
test.describe("Suite", {
  tag: ["@skip-ocp-helm-nightly", "@skip-ocp-operator-nightly"],
}, () => { ... });
```

See [Skip Tags](/overlay/reference/run-e2e#skip-tags) for the full derivation logic and how to use tags from a workspace directory.

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

See [Local OCI Testing](/overlay/reference/local-oci-testing) for the full local workflow and required files.

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

## Secrets in CI

Vault setup and usage details are documented here: [Using Secrets](/overlay/tutorials/using-secrets).

See [Configuration Files - rhdh-secrets.yaml](/overlay/test-structure/configuration-files#rhdh-secrets-yaml-optional) for more details on the secrets flow.


## CI Environment Variables

The following environment variables are available during CI execution:

| Variable | Description |
|----------|-------------|
| `K8S_CLUSTER_ROUTER_BASE` | Cluster router base domain |
| `RHDH_VERSION` | RHDH version to deploy |
| `INSTALLATION_METHOD` | `helm` or `operator` |
| `CI` | Set to `true` in CI environment |
| `GIT_PR_NUMBER` | PR number (enables OCI URL generation) — pr-check only |
| `JOB_NAME` | CI job name (if contains `periodic-`, disables metadata) |
| `JOB_MODE` | `nightly` or `pr-check` — set by step registry |
| `E2E_NIGHTLY_MODE` | `true` for nightly jobs |
| `E2E_TEST_UTILS_VERSION` | Pinned e2e-test-utils version (nightly only) |
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
