# Plugin Metadata

Utilities for loading and injecting plugin metadata from Package CRD files into dynamic plugins configuration.

## Import

```typescript
import {
  shouldInjectPluginMetadata,
  extractPluginName,
  getMetadataDirectory,
  parseAllMetadataFiles,
  injectMetadataConfig,
  generateDynamicPluginsConfigFromMetadata,
  loadAndInjectPluginMetadata,
} from "rhdh-e2e-test-utils/utils";
```

## Functions

### shouldInjectPluginMetadata()

Checks if plugin metadata handling should be enabled.

```typescript
function shouldInjectPluginMetadata(): boolean
```

**Returns:** `true` if metadata handling is enabled, `false` otherwise.

**Behavior:**
- Returns `false` if `RHDH_SKIP_PLUGIN_METADATA_INJECTION` environment variable is set
- Returns `false` if `JOB_NAME` contains `periodic-` (nightly/periodic builds)
- Returns `true` otherwise (default for local dev and PR builds)

**Example:**

```typescript
if (shouldInjectPluginMetadata()) {
  // Load and inject metadata
}
```

---

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

**Example:**

```typescript
const metadataDir = getMetadataDirectory();
if (metadataDir) {
  console.log(`Found metadata at: ${metadataDir}`);
}
```

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

**Example:**

```typescript
const metadataDir = getMetadataDirectory();
if (metadataDir) {
  const metadataMap = await parseAllMetadataFiles(metadataDir);
  console.log(`Found ${metadataMap.size} plugins`);
}
```

---

### injectMetadataConfig()

Injects plugin configurations from metadata into a dynamic plugins config.

```typescript
function injectMetadataConfig(
  dynamicPluginsConfig: DynamicPluginsConfig,
  metadataMap: Map<string, PluginMetadata>
): DynamicPluginsConfig
```

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `dynamicPluginsConfig` | [`DynamicPluginsConfig`](#dynamicpluginsconfig) | The config to augment |
| `metadataMap` | `Map<string, PluginMetadata>` | Map of plugin metadata |

**Returns:** Augmented configuration with injected pluginConfigs.

**Merge Behavior:** Metadata config serves as the base, user-provided pluginConfig overrides it.

---

### generateDynamicPluginsConfigFromMetadata()

Generates a complete dynamic-plugins configuration from metadata files.

```typescript
async function generateDynamicPluginsConfigFromMetadata(
  metadataPath?: string
): Promise<DynamicPluginsConfig>
```

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `metadataPath` | `string` | `"../metadata"` | Path to metadata directory |

**Returns:** Complete dynamic plugins configuration with all plugins enabled.

**Behavior:**
- Returns `{ plugins: [] }` if [`shouldInjectPluginMetadata()`](#shouldinjectpluginmetadata) returns `false`
- Throws error if metadata directory not found
- Throws error if no valid metadata files found
- All generated plugins have `disabled: false`

**PR Build Behavior (when `GIT_PR_NUMBER` is set):**
- Replaces local plugin paths with OCI URLs
- Fetches plugin versions from source repo's `package.json`
- Throws error if `source.json` or `plugins-list.yaml` not found
- Throws error if version fetching fails

**Example:**

```typescript
const config = await generateDynamicPluginsConfigFromMetadata();
console.log(`Generated config with ${config.plugins?.length} plugins`);
```

**Example Output (PR Build):**

```yaml
plugins:
  - package: oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/my-plugin:pr_1234__1.0.0
    disabled: false
    pluginConfig:
      # ... from metadata
```

---

### loadAndInjectPluginMetadata()

Main function to load and inject plugin metadata for PR builds.

```typescript
async function loadAndInjectPluginMetadata(
  dynamicPluginsConfig: DynamicPluginsConfig,
  metadataPath?: string
): Promise<DynamicPluginsConfig>
```

**Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `dynamicPluginsConfig` | [`DynamicPluginsConfig`](#dynamicpluginsconfig) | - | The config to augment |
| `metadataPath` | `string` | `"../metadata"` | Path to metadata directory |

**Returns:** Augmented configuration with metadata (for PR) or unchanged (for nightly).

**Behavior:**
- Returns config unchanged if [`shouldInjectPluginMetadata()`](#shouldinjectpluginmetadata) returns `false`
- Throws error if metadata directory not found
- Throws error if no valid metadata files found
- Only injects metadata for plugins already in the config

**Example:**

```typescript
const config = { plugins: [{ package: "./dynamic-plugins/dist/my-plugin", disabled: false }] };
const augmented = await loadAndInjectPluginMetadata(config);
```

## Types

### PluginMetadata

```typescript
interface PluginMetadata {
  /** The dynamic artifact path (e.g., ./dynamic-plugins/dist/plugin-name) */
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

- [Configuration Files](/guide/configuration/config-files#plugin-metadata-injection) - How metadata injection works during deployment
- [Environment Variables](/guide/configuration/environment-variables#plugin-metadata-variables) - Variables that control metadata handling
