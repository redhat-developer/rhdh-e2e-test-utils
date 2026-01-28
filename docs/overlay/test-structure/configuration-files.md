# Configuration Files

::: tip Overlay Documentation
This page covers writing tests within rhdh-plugin-export-overlays.
For using rhdh-e2e-test-utils in external projects, see the [Guide](/guide/).
:::

This page explains the YAML configuration files used in overlay E2E tests.

## All Configuration Files Are Optional

::: warning Key Concept
**All configuration files in `tests/config/` are optional.** The package provides sensible defaults for everything. Only create a configuration file when you need to:
- Override a default value
- Add plugin-specific configuration
- Configure external service URLs
:::

If your plugin works with the package defaults and metadata-based configuration, you may not need any configuration files at all.

## Configuration File Location

Configuration files are placed in `tests/config/`:

```
tests/config/
├── app-config-rhdh.yaml    # RHDH application configuration (optional)
├── rhdh-secrets.yaml       # Kubernetes secrets (optional)
├── dynamic-plugins.yaml    # Dynamic plugins (optional - usually not needed)
├── value_file.yaml         # Helm values override (optional, Helm only)
└── subscription.yaml       # Operator subscription (optional, Operator only)
```

**All of these files are optional.** Only create them when you need to override defaults or add additional configuration.

## app-config-rhdh.yaml (Optional)

The main RHDH configuration file. This file is merged with default configurations from `rhdh-e2e-test-utils`.

**Only create this file when you need to:**
- Set plugin-specific configuration values (e.g., `techRadar.url`)
- Allow external hosts for backend reading
- Customize the RHDH instance title
- Override any default RHDH configuration

### Purpose

- Set plugin-specific configuration values
- Configure backend settings
- Customize the RHDH instance title
- Allow external hosts for reading

### Structure

```yaml
# RHDH app config file
# This file merges with the default values from rhdh-e2e-test-utils

app:
  title: RHDH <Plugin Name> Test Instance

backend:
  reading:
    allow:
      - host: ${EXTERNAL_HOST}

# Plugin-specific configuration
<pluginName>:
  setting1: value1
  setting2: value2
```

### Referencing Secrets

Use `${VAR_NAME}` syntax to reference values from `rhdh-secrets.yaml`:

```yaml
backend:
  reading:
    allow:
      - host: ${TECH_RADAR_DATA_URL}
techRadar:
  url: "http://${TECH_RADAR_DATA_URL}/tech-radar"
```

These reference the Kubernetes Secret created by `rhdh-secrets.yaml`. The secret must define `TECH_RADAR_DATA_URL` for this to work.

### Real Example: Tech Radar

```yaml
# rhdh app config file
# this file is used to merge with the default values of the rhdh app config

app:
  title: RHDH Tech Radar Test Instance
backend:
  reading:
    allow:
      - host: ${TECH_RADAR_DATA_URL}
techRadar:
  url: "http://${TECH_RADAR_DATA_URL}/tech-radar"
```

## rhdh-secrets.yaml (Optional)

A Kubernetes Secret manifest that bridges environment variables to the RHDH deployment.

**Only create this file when you need to use environment variables in RHDH configuration files.**

### Environment Variable Substitution

::: warning Important
**Environment variable substitution is performed ONLY on `rhdh-secrets.yaml`.**

When this file is processed, any `$VAR_NAME` references are replaced with actual values from the environment. Other config files (`app-config-rhdh.yaml`, `dynamic-plugins.yaml`) do not get direct substitution - they reference the secrets created by this file.
:::

### When Is This File Needed?

| Where you need the variable | rhdh-secrets.yaml required? |
|-----------------------------|----------------------------|
| Test code (`*.spec.ts`) | No - use `process.env` directly |
| RHDH configs (`app-config-rhdh.yaml`, etc.) | Yes |

### How It Works

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│ Vault / .env    │────▶│ rhdh-secrets.yaml│────▶│ app-config-rhdh.yaml│
│ MY_SECRET=value │     │ MY_SECRET: $VAR  │     │ ${MY_SECRET}        │
│                 │     │ (substituted)    │     │ (references secret) │
└─────────────────┘     └──────────────────┘     └─────────────────────┘
```

1. Environment variable exists (from Vault in CI, or `.env` locally)
2. `rhdh-secrets.yaml` references it with `$VAR_NAME` - **substituted with actual value**
3. RHDH configs reference the secret with `${VAR_NAME}`

### Structure

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: rhdh-secrets
type: Opaque
stringData:
  # $VAR_NAME is replaced with the actual value from environment
  TECH_RADAR_DATA_URL: $TECH_RADAR_DATA_URL
  API_KEY: $VAULT_MY_API_KEY
```

### Real Example: Tech Radar

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: rhdh-secrets
type: Opaque
stringData:
  TECH_RADAR_DATA_URL: $TECH_RADAR_DATA_URL
```

Then in `app-config-rhdh.yaml`, you can use `${TECH_RADAR_DATA_URL}`:

```yaml
techRadar:
  url: "http://${TECH_RADAR_DATA_URL}/tech-radar"
```

## dynamic-plugins.yaml (Optional)

Configuration for dynamic plugins. This file is **optional** and in most cases **should not be provided**.

::: warning Best Practice
**Do NOT create `dynamic-plugins.yaml` unless you have a specific reason.** When the file doesn't exist, all plugins in the workspace are automatically enabled with their default configurations from metadata. Only create this file if you need to override specific plugin settings.
:::

### How Plugin Configuration is Generated

The package uses plugin metadata files (in `metadata/*.yaml` at the workspace level) to automatically configure plugins:

```
workspaces/<plugin-name>/
├── metadata/                        # Plugin metadata (Package CRD format)
│   ├── plugin-frontend.yaml         # Frontend plugin metadata
│   └── plugin-backend.yaml          # Backend plugin metadata
├── e2e-tests/                       # Your test project
│   └── tests/config/
│       └── dynamic-plugins.yaml     # Optional - usually not needed
└── plugins/                         # Plugin source code
```

The metadata files contain `spec.appConfigExamples` with the plugin's default configuration. These are automatically read and used during deployment.

### When File Doesn't Exist (Recommended)

When `tests/config/dynamic-plugins.yaml` is missing, the package **auto-generates** a complete configuration:

1. Scans for plugin metadata in `../metadata/` (relative to e2e-tests)
2. Reads each `*.yaml` file as Package CRD format
3. Extracts `spec.dynamicArtifact` and `spec.appConfigExamples[0].content`
4. Generates plugin entries with:
   - `package`: The dynamicArtifact path
   - `disabled: false` (enabled by default)
   - `pluginConfig`: From appConfigExamples
5. Merges with package defaults and auth config

**Result:** All plugins from metadata are enabled with their default configurations. This is the recommended approach for most plugins.

### When File Exists

When `tests/config/dynamic-plugins.yaml` exists:
1. Package defaults are loaded
2. Auth-specific plugins (keycloak/guest) are merged
3. Your custom config is merged on top (overrides earlier values)
4. Plugin metadata is injected only for plugins listed in your file

**Important:** If you provide this file, you take control of which plugins are enabled. Plugins not listed in your file won't get metadata injected automatically.

### When to Create This File

Only create this file when:
- You need to **disable** specific plugins
- You need to **override** default plugin settings from metadata
- The plugin has **no metadata** files
- You need **different configuration** than the metadata defaults

### Structure (If Needed)

```yaml
plugins:
  - package: "@company/backstage-plugin-example"
    disabled: false
    pluginConfig:
      example:
        setting: customValue  # Overrides metadata default
```

### See Also

For detailed information about plugin metadata handling, see the package documentation:
- [Plugin Metadata Guide](/guide/utilities/plugin-metadata)
- [Configuration Files Guide](/guide/configuration/config-files)

## value_file.yaml (Optional, Helm Only)

Override Helm chart values for RHDH deployment.

**Only create this file when you need to:**
- Override default Helm values
- Configure cluster-specific settings
- Customize resource limits or replicas

### Structure

```yaml
# Override Helm values
upstream:
  backstage:
    resources:
      limits:
        memory: 4Gi
```

This file is merged with the package's default Helm values.

## subscription.yaml (Optional, Operator Only)

Override Operator subscription settings.

**Only create this file when you need to:**
- Use a specific operator channel
- Configure operator-specific settings
- Override default subscription configuration

### Structure

```yaml
apiVersion: operators.coreos.com/v1alpha1
kind: Subscription
metadata:
  name: rhdh
spec:
  channel: fast
```

This file is merged with the package's default subscription configuration.

## Plugin Package References

When providing plugin packages (in `dynamic-plugins.yaml` if you create one), you can use either:

- **Local paths**: `./dynamic-plugins/dist/my-plugin`
- **OCI references**: `oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/my-plugin:1.0.0`

Both formats work for local development.

## PR Builds and OCI Images

When `GIT_PR_NUMBER` is set (either in CI or locally), the package automatically replaces plugin paths with OCI image references built from that PR.

### How It Works

1. The `/publish` command (as a PR comment) triggers a workflow that builds OCI images from the PR
2. Images are pushed to `ghcr.io/redhat-developer/rhdh-plugin-export-overlays`
3. When tests run with `GIT_PR_NUMBER` set (CI or local), the package:
   - Reads `source.json` and `plugins-list.yaml`
   - Fetches plugin versions from the source repo's `package.json` files
   - Replaces plugin paths with OCI URLs pointing to the PR-built images

### OCI URL Format

```
oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/{plugin-name}:pr_{PR_NUMBER}__{version}
```

### Automatic Replacement

**In CI (PR executions):** The replacement happens automatically. It doesn't matter what format you use in your configuration - it will be replaced with the OCI reference for that PR's built images.

**Locally with `GIT_PR_NUMBER`:** If you set `GIT_PR_NUMBER` locally, it will fetch and use the published OCI images from that PR. This is useful for testing PR builds locally.

```bash
# Test locally using PR 1845's published OCI images
export GIT_PR_NUMBER=1845
yarn test
```

### What You Don't Need to Do

The OCI URL replacement is **automatic**. You don't need to:
- Create or modify any configuration files for PR builds
- Specify OCI URLs manually
- Handle different configurations for local vs CI

The package handles this transparently based on the `GIT_PR_NUMBER` environment variable.

### Required Files for OCI URL Generation

When `GIT_PR_NUMBER` is set, these files must exist in the workspace root:

| File | Purpose |
|------|---------|
| `source.json` | Contains `repo` (GitHub URL) and `repo-ref` (commit SHA) |
| `plugins-list.yaml` | Lists plugin paths (e.g., `plugins/tech-radar:`) |

In CI, these are generated automatically. For local testing with `GIT_PR_NUMBER`, you may need to create them or copy them from a CI run.

::: warning Strict Validation
OCI URL generation is strict - deployment will fail if required files are missing or version fetching fails. This ensures builds don't silently fall back to local paths.
:::

## Configuration Merging

`rhdh-e2e-test-utils` merges your configuration with defaults in this order:

1. **Base defaults** from `rhdh-e2e-test-utils/config/common/`
2. **Auth-specific** from `rhdh-e2e-test-utils/config/auth/{guest,keycloak}/`
3. **Deployment method** from `rhdh-e2e-test-utils/config/{helm,operator}/`
4. **Your custom config** from `tests/config/`

Later files override earlier ones using deep merge.

### Merge Strategies

Arrays use the "replace" strategy by default:

```yaml
# Base config
backend:
  reading:
    allow:
      - host: localhost

# Your config (replaces the array)
backend:
  reading:
    allow:
      - host: ${EXTERNAL_HOST}

# Result
backend:
  reading:
    allow:
      - host: ${EXTERNAL_HOST}  # localhost is replaced
```

## Setting Environment Variables

Environment variables can be set in multiple ways:

### 1. In Test Code

Set variables in `beforeAll`:

```typescript
test.beforeAll(async ({ rhdh }) => {
  // Deploy external service first
  await $`bash ${setupScript} ${project}`;

  // Get the service URL and set as env var
  process.env.TECH_RADAR_DATA_URL = await getServiceUrl();

  // Now deploy RHDH (will use the env var)
  await rhdh.deploy();
});
```

### 2. In .env File

For local development:

```bash
# .env
TECH_RADAR_DATA_URL=my-service.example.com
```

### 3. In Vault (CI)

Add secrets to the Vault with `VAULT_` prefix. They are automatically exported during OpenShift CI execution:

```
VAULT_TECH_RADAR_DATA_URL: my-service.apps.cluster.example.com
```

Then reference in your config:

```yaml
techRadar:
  url: "http://${VAULT_TECH_RADAR_DATA_URL}/tech-radar"
```

::: warning Secret Naming
All secrets in Vault **must** start with `VAULT_` prefix for automatic export.
:::

## Common Configuration Patterns

### Allow External Hosts

```yaml
backend:
  reading:
    allow:
      - host: ${EXTERNAL_HOST}
```

### Set Plugin URL

```yaml
<pluginName>:
  url: "http://${SERVICE_URL}/<endpoint>"
```

### Custom App Title

```yaml
app:
  title: RHDH <Plugin> Test Instance
```

## Related Pages

- [Directory Layout](./directory-layout) - Where config files go
- [Spec Files](./spec-files) - Using config in tests
- [Environment Variables](/overlay/reference/environment-variables) - All supported variables
