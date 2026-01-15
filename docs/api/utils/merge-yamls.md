# YAML Merging API

Utilities for merging YAML files.

## Import

```typescript
import { mergeYamlFiles, mergeYamlFilesToFile } from "rhdh-e2e-test-utils/utils";
```

## `mergeYamlFiles()`

```typescript
function mergeYamlFiles(files: string[]): string
```

Merge YAML files and return content.

| Parameter | Type | Description |
|-----------|------|-------------|
| `files` | `string[]` | Array of file paths |

**Returns:** Merged YAML content as string.

## `mergeYamlFilesToFile()`

```typescript
function mergeYamlFilesToFile(files: string[], outputPath: string): void
```

Merge YAML files and write to file.

| Parameter | Type | Description |
|-----------|------|-------------|
| `files` | `string[]` | Array of file paths |
| `outputPath` | `string` | Output file path |

## Example

```typescript
import { mergeYamlFiles, mergeYamlFilesToFile } from "rhdh-e2e-test-utils/utils";

// Get merged content
const content = mergeYamlFiles([
  "base.yaml",
  "override.yaml",
]);

// Write to file
mergeYamlFilesToFile(
  ["base.yaml", "override.yaml"],
  "merged.yaml"
);
```
