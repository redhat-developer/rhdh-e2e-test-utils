# Plugin Metadata

Utilities for loading and processing plugin metadata from Package CRD files. These functions are used **internally** by `RHDHDeployment.deploy()` — most consumers don't need to call them directly.

::: info
Plugin metadata handling is fully automatic during `rhdh.deploy()`. The functions documented here are exported from the module for advanced use cases and testing, but are not part of the `./utils` public export path. They are imported internally by the deployment layer.
:::

## Functions

### extractPluginName()

Extracts the plugin name from a package path or OCI reference.

```typescript
function extractPluginName(packageRef: string): string
```

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `packageRef` | `string` | The package reference string |

**Returns:** The extracted plugin name.

**Supported Formats:**

| Format | Example | Extracted Name |
|--------|---------|----------------|
| Wrapper path | `./dynamic-plugins/dist/my-plugin` | `my-plugin` |
| OCI with tag | `oci://quay.io/rhdh/my-plugin:1.0.0` | `my-plugin` |
| OCI with digest | `oci://quay.io/rhdh/my-plugin@sha256:abc...` | `my-plugin` |
| OCI with alias | `oci://quay.io/rhdh/my-plugin@sha256:abc!alias` | `my-plugin` |
| GHCR | `ghcr.io/org/repo/my-plugin:tag` | `my-plugin` |

**Example:**

```typescript
const name = extractPluginName("oci://quay.io/rhdh/backstage-community-plugin-tech-radar:1.0.0");
// Returns: "backstage-community-plugin-tech-radar"
```

---

### getNormalizedPluginMergeKey()

Returns a stable merge key for a plugin entry so that OCI and local path for the same logical plugin match when merging dynamic-plugins configs. Strips a trailing `-dynamic` suffix so that e.g. `backstage-community-plugin-catalog-backend-module-keycloak-dynamic` (local) and `backstage-community-plugin-catalog-backend-module-keycloak` (from OCI) map to the same key.

```typescript
function getNormalizedPluginMergeKey(entry: { package?: string }): string
```

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `entry` | `{ package?: string }` | Plugin entry with optional package reference |

**Returns:** Normalized key for merge deduplication, or empty string if `package` is missing.

**Example:**

```typescript
// OCI and local path for the same plugin yield the same key
getNormalizedPluginMergeKey({
  package: "oci://ghcr.io/org/repo/backstage-community-plugin-catalog-backend-module-keycloak:tag!alias",
});
// Returns: "backstage-community-plugin-catalog-backend-module-keycloak"

getNormalizedPluginMergeKey({
  package: "./dynamic-plugins/dist/backstage-community-plugin-catalog-backend-module-keycloak-dynamic",
});
// Returns: "backstage-community-plugin-catalog-backend-module-keycloak"
```

---

### isNightlyJob()

Determines whether the current execution is a nightly/periodic job. Controls whether metadata config injection is enabled and which OCI resolution strategy is used.

```typescript
function isNightlyJob(): boolean
```

**Returns:** `true` if running in nightly mode, `false` for PR/local mode.

**Priority order:**
1. If `GIT_PR_NUMBER` is set → returns `false` (PR mode takes precedence)
2. If `E2E_NIGHTLY_MODE` is `"true"` or `"1"` → returns `true`
3. If `JOB_NAME` contains `periodic-` → returns `true`
4. Otherwise → returns `false`

---

### getMetadataDirectory()

Gets the metadata directory path.

```typescript
function getMetadataDirectory(metadataPath?: string): string | null
```

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `metadataPath` | `string` | `"../metadata"` | Path to metadata directory |

**Returns:** The resolved metadata directory path, or `null` if it doesn't exist.

---

### parseAllMetadataFiles()

Parses all metadata files in a directory and builds a map of plugin name to config.

```typescript
async function parseAllMetadataFiles(
  metadataDir: string
): Promise<Map<string, PluginMetadata>>
```

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `metadataDir` | `string` | Path to the metadata directory |

**Returns:** Map of plugin name to [`PluginMetadata`](#pluginmetadata).

---

### generatePluginsFromMetadata()

Auto-generates plugin entries from workspace metadata files when no user-provided `dynamic-plugins.yaml` exists. Each plugin is enabled by default.

```typescript
async function generatePluginsFromMetadata(
  metadataPath?: string
): Promise<DynamicPluginsConfig>
```

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `metadataPath` | `string` | `"../metadata"` | Path to metadata directory |

**Returns:** Dynamic plugins configuration with all plugins enabled (`disabled: false`).

---

### processPluginsForDeployment()

Unified entry point for both PR and nightly plugin resolution flows. Called automatically by `RHDHDeployment.deploy()`.

```typescript
async function processPluginsForDeployment(
  config: DynamicPluginsConfig,
  metadataPath?: string
): Promise<DynamicPluginsConfig>
```

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `config` | [`DynamicPluginsConfig`](#dynamicpluginsconfig) | - | The plugins config to process |
| `metadataPath` | `string` | `"../metadata"` | Path to metadata directory |

**Returns:** Processed configuration with resolved OCI references.

**Behavior:**
- **PR mode** (`!isNightlyJob()`): Injects `appConfigExamples` from metadata as base config, then resolves packages to OCI URLs (PR-specific if `GIT_PR_NUMBER` set, metadata refs otherwise)
- **Nightly mode** (`isNightlyJob()`): Resolves packages to OCI refs from metadata only (no config injection)
- Respects `RHDH_SKIP_PLUGIN_METADATA_INJECTION` to skip config injection

---

### disablePluginWrappers()

Creates a dynamic plugins config that disables wrapper plugins. Used during PR builds when wrapper plugins would conflict with PR-built OCI images.

```typescript
function disablePluginWrappers(plugins: string[]): DynamicPluginsConfig
```

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `plugins` | `string[]` | Plugin names to disable (e.g., `["backstage-community-plugin-tech-radar"]`) |

**Returns:** Config with each plugin set to `disabled: true` using local wrapper paths.

## Types

### PluginMetadata

```typescript
interface PluginMetadata {
  /** The dynamic artifact path (e.g., oci://ghcr.io/.../plugin-name:1.0.0) */
  packagePath: string;
  /** The plugin configuration from appConfigExamples[0].content */
  pluginConfig: Record<string, unknown>;
  /** The package name (e.g., @backstage-community/plugin-tech-radar) */
  packageName: string;
  /** Source metadata file path */
  sourceFile: string;
}
```

### PluginEntry

```typescript
interface PluginEntry {
  package: string;
  disabled?: boolean;
  pluginConfig?: Record<string, unknown>;
  [key: string]: unknown;
}
```

### DynamicPluginsConfig

```typescript
interface DynamicPluginsConfig {
  plugins?: PluginEntry[];
  includes?: string[];
  [key: string]: unknown;
}
```

## Constants

### DEFAULT_METADATA_PATH

```typescript
const DEFAULT_METADATA_PATH = "../metadata";
```

Default metadata directory path relative to the e2e-tests directory.

## See Also

- [Plugin Metadata Guide](/guide/utilities/plugin-metadata) - How metadata handling works during deployment
- [Configuration Files](/guide/configuration/config-files#plugin-metadata-injection) - Configuration merge behavior
- [Environment Variables](/guide/configuration/environment-variables#plugin-metadata-variables) - Variables that control metadata handling
