# YAML Merging

The package provides utilities for merging multiple YAML files.

## Usage

```typescript
import { mergeYamlFiles, mergeYamlFilesToFile } from "rhdh-e2e-test-utils/utils";
```

## `mergeYamlFiles(files)`

Merge multiple YAML files and return the merged content:

```typescript
const merged = mergeYamlFiles([
  "base-config.yaml",
  "override-config.yaml",
]);

console.log(merged);
```

### Merge Order

Later files override earlier files:

```typescript
const merged = mergeYamlFiles([
  "defaults.yaml",      // Base defaults
  "environment.yaml",   // Environment-specific
  "local.yaml",         // Local overrides
]);
```

## `mergeYamlFilesToFile(files, outputPath)`

Merge YAML files and write to a file:

```typescript
mergeYamlFilesToFile(
  [
    "config/base.yaml",
    "config/auth.yaml",
    "config/plugins.yaml",
  ],
  "config/merged.yaml"
);
```

## Deep Merging

The merge is deep, meaning nested objects are merged recursively:

**base.yaml:**
```yaml
app:
  title: Default Title
  baseUrl: http://localhost:7007
```

**override.yaml:**
```yaml
app:
  title: Production App
```

**Result:**
```yaml
app:
  title: Production App
  baseUrl: http://localhost:7007
```

## Complete Example

```typescript
import { test } from "rhdh-e2e-test-utils/test";
import { mergeYamlFilesToFile } from "rhdh-e2e-test-utils/utils";
import * as path from "path";

test.beforeAll(async ({ rhdh }) => {
  const configDir = path.join(import.meta.dirname, "config");

  // Merge configurations
  mergeYamlFilesToFile(
    [
      path.join(configDir, "base.yaml"),
      path.join(configDir, "plugins.yaml"),
    ],
    path.join(configDir, "merged.yaml")
  );

  await rhdh.configure({
    appConfig: path.join(configDir, "merged.yaml"),
  });

  await rhdh.deploy();
});
```
