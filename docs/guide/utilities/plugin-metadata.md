# Plugin Metadata

The plugin metadata utilities handle loading and injecting plugin configurations from Package CRD metadata files. This enables automatic configuration of dynamic plugins during deployment.

## How It Works

Plugin metadata is stored in `metadata/*.yaml` files alongside your plugin source code. These files follow the Package CRD format and contain `spec.appConfigExamples` with the plugin's default configuration.

```
workspaces/<plugin-name>/
├── metadata/                        # Plugin metadata files
│   ├── plugin-frontend.yaml         # Frontend plugin metadata
│   └── plugin-backend.yaml          # Backend plugin metadata
├── e2e-tests/                       # Your test project
│   └── tests/config/
│       └── dynamic-plugins.yaml     # Your plugin config (optional)
└── plugins/                         # Plugin source code
```

During deployment, the package reads these metadata files and:

- **Auto-generates** a complete config if `dynamic-plugins.yaml` doesn't exist
- **Injects** metadata into existing plugins if `dynamic-plugins.yaml` exists

## When Metadata Handling is Enabled

Metadata handling is **enabled by default** for:

- Local development
- PR builds in CI

Metadata injection is **disabled** when:

- `RHDH_SKIP_PLUGIN_METADATA_INJECTION` is set to `true` (local only — ignored in CI)

In **nightly mode** (`E2E_NIGHTLY_MODE=true` or `JOB_NAME` contains `periodic-`):

- Plugins listed in `default.packages.yaml` whose metadata `spec.dynamicArtifact` is an OCI ref use `{{inherit}}` tags — RHDH provides both the OCI tag and default config from its built-in DPDY
- Plugins NOT in `default.packages.yaml` whose metadata is an OCI ref use full metadata refs — with config injection (these plugins aren't in RHDH's built-in defaults)
- Wrapper plugins (local paths) keep their metadata paths — no config injection

::: info Priority
The `isNightlyJob()` function checks in this order:

1. If `GIT_PR_NUMBER` is set → PR mode (returns `false`, metadata injection enabled)
2. If `E2E_NIGHTLY_MODE` is `"true"` or `"1"` → nightly mode (returns `true`)
3. If `JOB_NAME` contains `periodic-` → nightly mode (returns `true`)
4. Otherwise → PR/local mode (returns `false`)

PR mode always takes precedence, preventing broken combinations of PR images with nightly config.
:::

## Usage

Plugin metadata handling is **fully automatic** — it runs inside `rhdh.deploy()` with no additional code required. You don't need to import or call any metadata functions directly.

```typescript
test.beforeAll(async ({ rhdh }) => {
  await rhdh.configure({ auth: "keycloak" });
  await rhdh.deploy(); // Metadata is loaded, injected, and resolved automatically
});
```

### What Happens During deploy()

1. **Config assembly**:
   - If `dynamic-plugins.yaml` **exists**: merged with package defaults + auth config
   - If `dynamic-plugins.yaml` **doesn't exist**: auto-generated from all `metadata/*.yaml` files, then merged with defaults/auth (deduplicated by normalized plugin name — OCI wins over local `-dynamic` paths)

2. **Metadata injection**:
   - **PR/local**: `appConfigExamples` from metadata merged as base config; user `pluginConfig` overrides
   - **Nightly**: only for plugins NOT in `default.packages.yaml` whose metadata is OCI (plugins in `default.packages.yaml` get both config and OCI tag via `{{inherit}}`)

3. **Package resolution** — per plugin, in priority order:
   | Condition | Result |
   |-----------|--------|
   | Plugin in workspace build + `GIT_PR_NUMBER` set | PR OCI URL: `pr_{number}__{version}` |
   | Nightly + in `default.packages.yaml` + OCI metadata | `{{inherit}}` tag (RHDH resolves both OCI tag and default config from its built-in DPDY) |
   | Plugin has metadata with OCI `dynamicArtifact` | Metadata's OCI ref (preserves original registry) |
   | Plugin has metadata with wrapper path | Wrapper path from metadata |
   | No metadata match (cross-workspace plugins, npm packages) | Kept as-is |

4. **Wrapper disabling** (PR builds only, when `GIT_PR_NUMBER` set):
   - Appends `disabled: true` entries for wrapper plugins listed in `disableWrappers`

::: info Multiple OCI Registries
Plugin OCI references use the **actual registry** from each plugin's `spec.dynamicArtifact` — not a single hardcoded registry. Plugins can come from `ghcr.io`, `quay.io/rhdh`, `registry.access.redhat.com/rhdh`, or other registries.
:::

## Extract Plugin Name

The utilities support various package reference formats:

```typescript
import { extractPluginName } from "@red-hat-developer-hub/e2e-test-utils/utils";

// All of these extract "my-plugin"
extractPluginName("./dynamic-plugins/dist/my-plugin");
extractPluginName("oci://quay.io/rhdh/my-plugin:1.0.0");
extractPluginName("oci://quay.io/rhdh/my-plugin@sha256:abc123");
extractPluginName("ghcr.io/org/repo/my-plugin:tag");
```

## Parse Metadata Files

For custom handling, you can parse metadata files directly:

```typescript
import {
  getMetadataDirectory,
  parseAllMetadataFiles,
} from "@red-hat-developer-hub/e2e-test-utils/utils";

const metadataDir = getMetadataDirectory();
if (metadataDir) {
  const metadataMap = await parseAllMetadataFiles(metadataDir);

  for (const [pluginName, metadata] of metadataMap) {
    console.log(`Plugin: ${pluginName}`);
    console.log(`  Package: ${metadata.packagePath}`);
    console.log(`  Config:`, metadata.pluginConfig);
  }
}
```

## Deployment Integration

The `RHDHDeployment` class automatically uses these utilities during `deploy()`:

1. If `dynamic-plugins.yaml` exists:
   - Merges package defaults + auth config + your config
   - Injects metadata for plugins in your config

2. If `dynamic-plugins.yaml` doesn't exist:
   - Auto-generates from all metadata files
   - Merges with package defaults and auth-specific plugins (e.g. Keycloak)
   - Deduplicates by normalized plugin name so the same logical plugin appears once (metadata/OCI wins)
   - All plugins enabled with default configurations

See [Configuration Files](/guide/configuration/config-files#plugin-metadata-injection) for detailed behavior.

## OCI URL Generation for PR Builds

When `GIT_PR_NUMBER` is set (by OpenShift CI), local plugin paths are automatically replaced with OCI URLs pointing to the PR's built artifacts.

### How It Works

1. Reads `source.json` from the workspace directory to get the source repo and commit ref
2. Reads `plugins-list.yaml` to get the list of plugin paths
3. Fetches each plugin's `package.json` from the source repo to get the current version
4. Generates OCI URLs in the format:

```
oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/{plugin-name}:pr_{PR_NUMBER}__{version}
```

### Example

```yaml
# Local development
- package: ./dynamic-plugins/dist/backstage-community-plugin-tech-radar

# PR build (GIT_PR_NUMBER=1845)
- package: oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/backstage-community-plugin-tech-radar:pr_1845__1.13.0
```

### Required Files

For OCI URL generation, your workspace must have these files (generated by CI):

| File                | Purpose                                                  |
| ------------------- | -------------------------------------------------------- |
| `source.json`       | Contains `repo` (GitHub URL) and `repo-ref` (commit SHA) |
| `plugins-list.yaml` | Lists plugin paths (e.g., `plugins/tech-radar:`)         |

::: warning
For PR builds, OCI URL generation is strict - deployment will fail if required files are missing or version fetching fails. This ensures PR builds don't silently fall back to local paths.
:::

## Mode Comparison

The system operates in three modes based on environment variables:

|                                             | **PR Check**             | **Nightly**                                                   | **Local Dev**     |
| ------------------------------------------- | ------------------------ | ------------------------------------------------------------- | ----------------- |
| **Trigger**                                 | `GIT_PR_NUMBER` set      | `E2E_NIGHTLY_MODE=true`                                       | No env vars       |
| **Config injection**                        | Yes — all plugins        | Only plugins NOT in `default.packages.yaml` with OCI metadata | Yes — all plugins |
| **`default.packages.yaml` OCI plugins**     | PR tags or metadata refs | `{{inherit}}` tag (RHDH provides both OCI tag and config)     | Metadata refs     |
| **Non-`default.packages.yaml` OCI plugins** | PR tags or metadata refs | Metadata refs + config injection                              | Metadata refs     |
| **Wrapper plugins**                         | Metadata path            | Metadata path                                                 | Metadata path     |
| **Wrapper disabling**                       | Yes (`disableWrappers`)  | No                                                            | No                |
| **Cross-workspace plugins**                 | Kept as-is               | Kept as-is                                                    | Kept as-is        |

### DPDY vs Non-DPDY in Nightly

DPDY refers to `dynamic-plugins.default.yaml` in the catalog index image shipped with RHDH. The list of DPDY packages is defined in [`default.packages.yaml`](https://github.com/redhat-developer/rhdh/blob/main/default.packages.yaml) (both `enabled` and `disabled` sections). In nightly mode:

- **In `default.packages.yaml` + OCI metadata**: Use `{{inherit}}` tag — RHDH resolves both the OCI tag (version) and default config from its built-in DPDY. This tests the exact versions and configuration shipped in the RC. No config injection from our side. The registry defaults to `registry.access.redhat.com/rhdh` and can be overridden with `NIGHTLY_DPDY_OCI_REGISTRY` (blanket) or `NIGHTLY_DPDY_OCI_REGISTRY_MAP` (per-plugin JSON, takes precedence).
- **NOT in `default.packages.yaml` + OCI metadata**: Use full metadata refs from `spec.dynamicArtifact`. Config injection enabled — these plugins aren't in RHDH's built-in defaults, so they need `appConfigExamples` from metadata.
- **Wrapper plugins** (local paths in `spec.dynamicArtifact`): Always use the metadata wrapper path regardless of `default.packages.yaml` status. No config injection.

The DPDY list is fetched at runtime from the `rhdh` repo using `RELEASE_BRANCH_NAME` (required in CI, defaults to `main` locally).

### processPluginsForDeployment

This is the unified entry point for both PR and nightly plugin resolution flows. It is called automatically during `deploy()`.

```
Step 1: Inject metadata configs
  → PR/local: deepMerge(metadata.appConfigExamples, user.pluginConfig) for all plugins
  → Nightly: only plugins NOT in default.packages.yaml with OCI metadata get injection
    (plugins in default.packages.yaml get both config and OCI tag via {{inherit}})
  → Skipped locally when RHDH_SKIP_PLUGIN_METADATA_INJECTION="true" (ignored in CI)

Step 2: Resolve packages (both modes)
  → Per plugin: PR OCI URL > DPDY {{inherit}} > metadata OCI ref > wrapper path > passthrough
  → {{inherit}} registry: NIGHTLY_DPDY_OCI_REGISTRY_MAP > NIGHTLY_DPDY_OCI_REGISTRY > registry.access.redhat.com/rhdh
```

## Environment Variables

| Variable                              | Effect                                                                                                                 |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `GIT_PR_NUMBER`                       | Enables OCI URL generation for PR builds                                                                               |
| `E2E_NIGHTLY_MODE`                    | When `true`, activates nightly mode (`default.packages.yaml` OCI plugins → `{{inherit}}`, others → full metadata refs) |
| `RELEASE_BRANCH_NAME`                 | Branch for fetching `default.packages.yaml` (required in CI, defaults to `main` locally)                               |
| `NIGHTLY_DPDY_OCI_REGISTRY`           | Blanket override for `{{inherit}}` registry (default: `registry.access.redhat.com/rhdh`)                               |
| `NIGHTLY_DPDY_OCI_REGISTRY_MAP`       | Per-plugin registry override as JSON: `{"registry": ["pkg1", "pkg2"]}` (takes precedence over blanket)                 |
| `RHDH_SKIP_PLUGIN_METADATA_INJECTION` | Disables metadata injection (local only, ignored in CI)                                                                |
| `JOB_NAME`                            | If contains `periodic-`, activates nightly mode                                                                        |
| `JOB_MODE`                            | CI-only: `nightly` or `pr-check` (set by step registry)                                                                |

See [Environment Variables](/guide/configuration/environment-variables#plugin-metadata-variables) for details.

## API Reference

For complete API documentation, see [Plugin Metadata API](/api/utils/plugin-metadata).

::: tip For Overlay Repository
If you're writing tests in the **rhdh-plugin-export-overlays** repository, see [Overlay Configuration Files](/overlay/test-structure/configuration-files) for how plugin metadata and OCI URL generation work in that context.
:::
