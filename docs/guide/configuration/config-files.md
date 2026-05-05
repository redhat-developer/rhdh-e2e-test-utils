# Configuration Files

RHDH deployment uses YAML configuration files for app config, plugins, and secrets.

If you are working inside the overlay repository, see [Overlay Configuration Files](/overlay/test-structure/configuration-files) for overlay-specific behavior and CI integration details.

## File Structure

Create configuration files in `tests/config/`:

```
tests/config/
├── app-config-rhdh.yaml    # Application configuration
├── dynamic-plugins.yaml    # Plugin configuration
├── rhdh-secrets.yaml       # Secrets with env placeholders
└── value_file.yaml         # Helm values (optional)
```

## app-config-rhdh.yaml

Application configuration for RHDH:

```yaml
app:
  title: My Plugin Test Instance
  baseUrl: https://backstage-${NAMESPACE}.${K8S_CLUSTER_ROUTER_BASE}

backend:
  baseUrl: https://backstage-${NAMESPACE}.${K8S_CLUSTER_ROUTER_BASE}
  cors:
    origin: https://backstage-${NAMESPACE}.${K8S_CLUSTER_ROUTER_BASE}
  reading:
    allow:
      - host: "*.example.com"

# Plugin-specific configuration
techRadar:
  url: "http://${DATA_SOURCE_URL}/tech-radar"

catalog:
  rules:
    - allow: [Component, API, Template, System, Domain, Group, User]
```

## dynamic-plugins.yaml

Configure dynamic plugins:

::: tip `useNewFrontendSystem`
If you run against the **app-next** shell, enable the new frontend system (pass `useNewFrontendSystem: true`, use a project/namespace suffix **`-app-next`**, or set **`USE_NEW_FRONTEND_SYSTEM=true`** — see [RHDH deployment](/guide/deployment/rhdh-deployment#new-frontend-system-usenewfrontendsystem)). The package merges default **app-auth** and **app-integrations** OCI plugins as **defaults**; override versions in this file when they must differ.
:::

```yaml
includes:
  - dynamic-plugins.default.yaml

plugins:
  # Enable your plugin
  - package: ./dynamic-plugins/dist/my-frontend-plugin
    disabled: false
    pluginConfig:
      dynamicPlugins:
        frontend:
          my-frontend-plugin:
            mountPoints:
              - mountPoint: entity.page.overview/cards
                importName: MyPluginCard
                config:
                  layout:
                    gridColumnEnd: span 4

  # Backend plugin
  - package: ./dynamic-plugins/dist/my-backend-plugin-dynamic
    disabled: false

  # Disable default plugins if needed
  - package: ./dynamic-plugins/dist/some-default-plugin
    disabled: true
```

## rhdh-secrets.yaml

Secrets with environment variable substitution:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: rhdh-secrets
type: Opaque
stringData:
  # GitHub integration
  GITHUB_TOKEN: ${GITHUB_TOKEN}

  # Custom API keys
  MY_API_KEY: ${MY_API_KEY:-default-key}

  # Backend auth
  BACKEND_SECRET: ${BACKEND_SECRET}
```

Environment variables are substituted at deployment time.

## value_file.yaml (Helm)

Helm values for RHDH chart:

```yaml
global:
  clusterRouterBase: ${K8S_CLUSTER_ROUTER_BASE}

upstream:
  backstage:
    image:
      registry: quay.io
      repository: rhdh/rhdh-hub-rhel9
      tag: ${RHDH_VERSION}

    extraEnvVars:
      - name: LOG_LEVEL
        value: "debug"

    extraEnvVarsSecrets:
      - rhdh-secrets

  postgresql:
    enabled: true
    auth:
      secretKeys:
        adminPasswordKey: postgres-password
        userPasswordKey: password
```

## Configuration Merging Order

When you deploy RHDH, configurations are merged:

```
1. Package: config/common/app-config-rhdh.yaml
2. Package: config/auth/{provider}/app-config.yaml
3. Project: tests/config/app-config-rhdh.yaml
```

Later files override earlier files. You only need to specify what's different from defaults.

## Verify the Final Merged Config

If you need to confirm the final merged configuration:

1. Run a test once so RHDH is deployed.
2. Inspect the ConfigMaps in the test namespace:

```bash
oc get configmap -n <namespace>
oc get configmap app-config-rhdh -n <namespace> -o yaml
oc get configmap dynamic-plugins -n <namespace> -o yaml
```

This shows the exact content after defaults, auth config, and your overrides are merged.

## Plugin Metadata Injection

During deployment, the package automatically handles plugin configurations from metadata files. The behavior depends on whether your [`dynamic-plugins.yaml`](#dynamic-plugins-yaml) file exists:

```
┌─────────────────────────────────────┐
│  dynamic-plugins.yaml exists?       │
└──────────────┬──────────────────────┘
               │
       ┌───────┴───────┐
       │               │
      YES              NO
       │               │
       ▼               ▼
┌──────────────┐  ┌──────────────────────┐
│ Inject into  │  │ Auto-generate from   │
│ existing     │  │ ALL metadata files   │
│ plugins only │  │ (all enabled)        │
└──────────────┘  └──────────────────────┘
```

```
workspaces/<plugin-name>/
├── metadata/                           # Plugin metadata files
│   ├── plugin-frontend.yaml            # Contains spec.appConfigExamples
│   └── plugin-backend.yaml
├── e2e-tests/
│   └── tests/config/
│       └── dynamic-plugins.yaml        # Your plugin config (optional)
└── plugins/                            # Plugin source code
```

### Auto-Generation (No Config File)

If your `dynamic-plugins.yaml` file doesn't exist, the package **auto-generates** a complete configuration:

1. Iterates through all metadata files in `../metadata/`
2. Creates plugin entries with `disabled: false` (enabled)
3. Uses `spec.appConfigExamples[0].content` as the plugin config
4. Merges the result with package defaults and auth-specific plugins (e.g. Keycloak)

Entries for the **same logical plugin** (e.g. keycloak from metadata and from auth) are **deduplicated**: the plugin appears once in the final config. When both metadata and auth list the same plugin, the metadata-derived entry wins (e.g. the OCI URL on PR builds is kept instead of the auth default local path).

This is useful when you want to test all plugins with their default configurations without writing a `dynamic-plugins.yaml`.

### Injection (Config File Exists)

If your `dynamic-plugins.yaml` file exists, the package **injects** metadata only for plugins listed in your config:

1. Looks for matching metadata files in `../metadata/`
2. Merges: **metadata (base) + your config (override)**
3. Plugins not in your config are **not** added automatically

Your `pluginConfig` in `dynamic-plugins.yaml` overrides values from metadata.

### When Injection is Enabled

Plugin metadata injection is **enabled by default** for:

- Local development
- PR builds in CI

Injection is **disabled locally** when:

- [`RHDH_SKIP_PLUGIN_METADATA_INJECTION`](/guide/configuration/environment-variables#plugin-metadata-variables) is set to `true` (ignored in CI)

In **nightly mode** (`E2E_NIGHTLY_MODE=true` or `JOB_NAME` contains `periodic-`):

- Only plugins NOT in `default.packages.yaml` with OCI metadata get injection; plugins in `default.packages.yaml` use `{{inherit}}` — RHDH resolves both the OCI tag and default config from its built-in DPDY

::: warning
When injection is enabled, deployment will fail if:

- The `metadata/` directory doesn't exist
- No valid metadata files are found in the directory
  :::

### OCI URL Replacement for PR Builds

When `GIT_PR_NUMBER` is set (by OpenShift CI), local plugin paths are automatically replaced with OCI URLs pointing to the PR's built artifacts:

```yaml
# Local development
- package: ./dynamic-plugins/dist/backstage-community-plugin-tech-radar

# PR build (GIT_PR_NUMBER=1845)
- package: oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/backstage-community-plugin-tech-radar:pr_1845__1.13.0
```

This allows E2E tests to run against the actual OCI images built for the PR.

### Local Reproduction (Optional)

If you want to reproduce OCI URL replacement locally, create the required files at the workspace root:

**source.json**

```json
{
  "repo": "https://github.com/redhat-developer/rhdh-plugin-export-overlays",
  "repo-ref": "abc123def4567890"
}
```

**plugins-list.yaml**

```yaml
plugins/tech-radar:
plugins/my-plugin:
```

Then set `GIT_PR_NUMBER` and run tests:

```bash
export GIT_PR_NUMBER=1845
yarn test
```

::: warning
For PR builds, OCI URL generation is required. Deployment will fail if `source.json` or `plugins-list.yaml` doesn't exist, or if version fetching fails.
:::

See [Plugin Metadata - OCI URL Generation](/guide/utilities/plugin-metadata#oci-url-generation-for-pr-builds) for complete details.

### Package Reference Matching

The package automatically matches plugins across different reference formats:

| Format          | Example                                      |
| --------------- | -------------------------------------------- |
| Wrapper path    | `./dynamic-plugins/dist/my-plugin`           |
| OCI with tag    | `oci://quay.io/rhdh/my-plugin:1.0.0`         |
| OCI with digest | `oci://quay.io/rhdh/my-plugin@sha256:abc...` |
| GHCR            | `ghcr.io/org/repo/my-plugin:tag`             |

All formats extract the plugin name (`my-plugin`) for matching against metadata.

## Environment Variable Substitution

Use these syntaxes in YAML files:

| Syntax            | Description         |
| ----------------- | ------------------- |
| `$VAR`            | Simple substitution |
| `${VAR}`          | Braced substitution |
| `${VAR:-default}` | Default if unset    |

Example:

```yaml
backend:
  baseUrl: https://backstage-${NAMESPACE}.${K8S_CLUSTER_ROUTER_BASE}
  database:
    client: pg
    connection:
      port: ${DB_PORT:-5432}
```

## Best Practices

1. **Use environment variables** for secrets and dynamic values
2. **Keep configs minimal** - only override what's needed
3. **Use default values** for optional settings
4. **Separate concerns** - app config, plugins, secrets in different files
5. **Version control** configs but not secrets
