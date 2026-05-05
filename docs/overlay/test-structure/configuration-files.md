# Configuration Files

::: tip Overlay Documentation
This page covers writing tests within rhdh-plugin-export-overlays.
For using @red-hat-developer-hub/e2e-test-utils in external projects, see the [Guide](/guide/).
:::

This page explains the YAML configuration files used in overlay E2E tests.

If you're looking for the general file formats and examples, see [Configuration Files (Guide)](/guide/configuration/config-files). This page focuses on overlay-specific behavior such as metadata auto-generation and OCI URL replacement.

## All Configuration Files Are Optional

::: warning Key Concept
**All configuration files in `tests/config/` are optional.** The package provides sensible defaults. Only create a configuration file when you need to **override** or **extend** the defaults (i.e., when the default config does not already cover your use case).
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
├── value_file-app-next.yaml # Extra Helm values when new frontend system is active (optional)
└── subscription.yaml       # Operator subscription (optional, Operator only)
```

**All of these files are optional.** Only create them when you need to override or extend defaults.

## `useNewFrontendSystem` (app-next / NFS)

When the new frontend system is enabled (see [`configure()`](/guide/deployment/rhdh-deployment#configureoptions) and [New frontend system](/guide/deployment/rhdh-deployment#new-frontend-system-usenewfrontendsystem)), `@red-hat-developer-hub/e2e-test-utils` merges:

- **Secrets** — `APP_CONFIG_app_packageName=app-next` and `ENABLE_STANDARD_MODULE_FEDERATION=true` into the `rhdh-secrets` Secret (merged with common/auth/workspace layers before `envsubst`; you no longer need duplicate keys in a separate `rhdh-secrets-next.yaml` for that).
- **Dynamic plugins** — Default OCI entries for **app-auth** and **app-integrations** as package defaults; override versions in `tests/config/dynamic-plugins.yaml` ([guide](/guide/configuration/config-files#dynamic-pluginsyaml)).

You can **remove** hand-maintained `app-auth` / `app-integrations` lines from `dynamic-plugins.yaml` when the framework defaults match your train.

Optional **`value_file-app-next.yaml`** is merged last when the new frontend system is active and the file exists — use for chart tweaks specific to app-next runs.

## app-config-rhdh.yaml (Optional)

The main RHDH configuration file. This file is merged with default configurations from `@red-hat-developer-hub/e2e-test-utils`.

**Only create this file when you need to:**
- Override a default value in the RHDH app config
- Add config keys that are not provided by the defaults

### Purpose

- Set plugin-specific configuration values
- Configure backend settings
- Customize the RHDH instance title
- Allow external hosts for reading

### Structure

```yaml
# RHDH app config file
# This file merges with the default values from @red-hat-developer-hub/e2e-test-utils

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

**Only create this file when you need to pass environment variables into RHDH configuration files.**

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

## Plugin Package Resolution

Plugin `package` references in `dynamic-plugins.yaml` are automatically resolved before deployment. The framework uses workspace `metadata/*.yaml` files as the source of truth — whatever `spec.dynamicArtifact` says (OCI ref or wrapper path), that's what the plugin resolves to.

The resolution behaves differently in PR, nightly, and local dev modes. For the complete resolution logic with concrete input/output examples, see **[Plugin Metadata Resolution](../reference/plugin-metadata-resolution)**.

## Configuration Merging

`@red-hat-developer-hub/e2e-test-utils` merges your configuration with defaults in this order:

1. **Base defaults** from `@red-hat-developer-hub/e2e-test-utils/config/common/`
2. **Auth-specific** from `@red-hat-developer-hub/e2e-test-utils/config/auth/{guest,keycloak}/`
3. **Deployment method** from `@red-hat-developer-hub/e2e-test-utils/config/{helm,operator}/`
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

## Real-World Workspace Patterns

These examples show how different workspaces use `dynamic-plugins.yaml` and how the package resolves their plugins.

### Auto-Generated (No dynamic-plugins.yaml)

**Workspaces:** tech-radar, quickstart, acr

When no `dynamic-plugins.yaml` exists, the package auto-generates entries from all `metadata/*.yaml` files:

```yaml
# Auto-generated at deploy time:
plugins:
  - package: oci://ghcr.io/.../backstage-community-plugin-tech-radar:bs_1.45.3__1.13.0
    disabled: false
    # pluginConfig injected from metadata appConfigExamples (PR/local mode)
```

No configuration files needed — metadata provides everything.

### Cross-Workspace Plugins

**Workspace:** argocd

When your workspace needs plugins from another workspace (e.g., Kubernetes backend for ArgoCD):

```yaml
plugins:
  # Workspace plugin — resolved to metadata OCI ref (or PR tag)
  - package: oci://ghcr.io/.../backstage-community-plugin-argocd:bs_1.45.3__2.4.3!backstage-community-plugin-argocd
    pluginConfig:
      dynamicPlugins:
        frontend: { ... }

  # Cross-workspace plugin — no metadata match, kept as-is
  - package: ./dynamic-plugins/dist/backstage-plugin-kubernetes-backend-dynamic
```

Cross-workspace plugins have no metadata in the current workspace, so they pass through unchanged in all modes.

### OCI Aliases

**Workspace:** redhat-resource-optimization

Some plugins share a single OCI image with multiple plugins distinguished by aliases (the `!alias` suffix):

```yaml
plugins:
  - package: oci://quay.io/redhat-resource-optimization/dynamic-plugins:1.3.2!red-hat-developer-hub-plugin-redhat-resource-optimization
```

The alias after `!` tells RHDH which plugin to extract from the shared image.

### Disabled Wrapper Plugins

**Workspace:** scorecard

When your workspace uses an OCI image for a plugin that also has a local wrapper enabled by default:

```yaml
plugins:
  # Workspace plugin — resolved to metadata ref
  - package: oci://ghcr.io/.../red-hat-developer-hub-backstage-plugin-scorecard:tag!alias

  # Cross-workspace OCI — kept as-is
  - package: oci://ghcr.io/.../red-hat-developer-hub-backstage-plugin-dynamic-home-page:tag!alias

  # Disable the local wrapper to avoid conflicts
  - package: ./dynamic-plugins/dist/red-hat-developer-hub-backstage-plugin-dynamic-home-page
    disabled: true
```

### Different OCI Registries

Plugins can come from different registries. The package preserves the original registry from each plugin's metadata:

```yaml
# ghcr.io (community plugins)
- package: oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/backstage-community-plugin-tech-radar:bs_1.45.3__1.13.0

# quay.io (Red Hat plugins)
- package: oci://quay.io/rhdh/red-hat-developer-hub-backstage-plugin-scaffolder-relation-processor@sha256:abc123

# registry.access.redhat.com (certified plugins)
- package: oci://registry.access.redhat.com/rhdh/red-hat-developer-hub-backstage-plugin-orchestrator@sha256:f40d39fb
```

### npm Packages

**Workspace:** global-header

For plugins published to npm instead of OCI:

```yaml
plugins:
  - package: "@red-hat-developer-hub/backstage-plugin-global-header-test@0.0.2"
    integrity: "sha512-ABC123..."
```

npm packages with integrity hashes pass through unchanged in all modes — no metadata resolution.

### All Local Paths

**Workspace:** topology

Some workspaces use only local paths (no OCI references in their config):

```yaml
plugins:
  - package: ./dynamic-plugins/dist/backstage-community-plugin-topology
  - package: ./dynamic-plugins/dist/backstage-plugin-kubernetes-backend-dynamic
```

In PR mode, `pluginConfig` from metadata is injected. In nightly mode, local paths are resolved to metadata OCI refs if metadata exists. Local paths with no metadata match stay unchanged.

## Related Pages

- [Directory Layout](./directory-layout) - Where config files go
- [Spec Files](./spec-files) - Using config in tests
- [Environment Variables](/overlay/reference/environment-variables) - All supported variables
- [Plugin Metadata Resolution](/overlay/reference/plugin-metadata-resolution) - How package resolution works in PR, nightly, and local modes
- [Local OCI Testing](/overlay/reference/local-oci-testing) - Testing with PR-built OCI images locally
