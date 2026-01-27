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

Metadata handling is **disabled** when:
- `RHDH_SKIP_PLUGIN_METADATA_INJECTION` is set
- `JOB_NAME` contains `periodic-` (nightly builds)

## Basic Usage

### Check If Enabled

```typescript
import { shouldInjectPluginMetadata } from "rhdh-e2e-test-utils/utils";

if (shouldInjectPluginMetadata()) {
  console.log("Metadata handling is enabled");
}
```

### Auto-Generate Configuration

When your `dynamic-plugins.yaml` doesn't exist, generate a complete config from all metadata files:

```typescript
import { generateDynamicPluginsConfigFromMetadata } from "rhdh-e2e-test-utils/utils";

const config = await generateDynamicPluginsConfigFromMetadata();
// All plugins from metadata/*.yaml are enabled by default
```

### Inject Into Existing Configuration

When you have a `dynamic-plugins.yaml`, inject metadata for listed plugins:

```typescript
import { loadAndInjectPluginMetadata } from "rhdh-e2e-test-utils/utils";

const existingConfig = {
  plugins: [
    {
      package: "./dynamic-plugins/dist/my-plugin",
      disabled: false,
      pluginConfig: {
        // Your overrides here
      },
    },
  ],
};

const augmented = await loadAndInjectPluginMetadata(existingConfig);
// Metadata is merged as base, your pluginConfig overrides it
```

## Extract Plugin Name

The utilities support various package reference formats:

```typescript
import { extractPluginName } from "rhdh-e2e-test-utils/utils";

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
} from "rhdh-e2e-test-utils/utils";

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
   - All plugins enabled with default configurations

See [Configuration Files](/guide/configuration/config-files#plugin-metadata-injection) for detailed behavior.

## Environment Variables

| Variable | Effect |
|----------|--------|
| `RHDH_SKIP_PLUGIN_METADATA_INJECTION` | Disables all metadata handling |
| `JOB_NAME` | If contains `periodic-`, disables metadata handling |

See [Environment Variables](/guide/configuration/environment-variables#plugin-metadata-variables) for details.

## API Reference

For complete API documentation, see [Plugin Metadata API](/api/utils/plugin-metadata).
