# Utilities Overview

The package provides utility functions for common operations in E2E testing.

## Available Utilities

| Utility | Purpose |
|---------|---------|
| [KubernetesClientHelper](/guide/utilities/kubernetes-client) | Kubernetes API operations |
| [Bash ($)](/guide/utilities/bash-utilities) | Shell command execution |
| [YAML Merging](/guide/utilities/yaml-merging) | Merge YAML files |
| [envsubst](/guide/utilities/environment-substitution) | Environment variable substitution |
| [Plugin Metadata](/guide/utilities/plugin-metadata) | Plugin metadata injection |
| [WorkspacePaths](#workspacepaths) | Workspace config file path resolution |

## Importing Utilities

```typescript
import {
  $,
  KubernetesClientHelper,
  WorkspacePaths,
  envsubst,
  mergeYamlFiles,
  mergeYamlFilesToFile,
} from "@red-hat-developer-hub/e2e-test-utils/utils";
```

## Quick Examples

### Bash Commands

```typescript
import { $ } from "@red-hat-developer-hub/e2e-test-utils/utils";

// Execute commands
await $`oc get pods -n my-namespace`;

// Capture output
const result = await $`oc get pods -o json`;
console.log(result.stdout);
```

### Kubernetes Operations

```typescript
import { KubernetesClientHelper } from "@red-hat-developer-hub/e2e-test-utils/utils";

const k8s = new KubernetesClientHelper();

// Create namespace
await k8s.createNamespaceIfNotExists("my-namespace");

// Apply ConfigMap
await k8s.applyConfigMapFromObject("my-config", { key: "value" }, "my-namespace");

// Get route URL
const url = await k8s.getRouteLocation("my-namespace", "my-route");
```

### Environment Substitution

```typescript
import { envsubst } from "@red-hat-developer-hub/e2e-test-utils/utils";

const template = "API URL: ${API_URL:-http://localhost}";
const result = envsubst(template);
// Result: "API URL: http://localhost" (if API_URL not set)
```

### YAML Merging

```typescript
import { mergeYamlFiles } from "@red-hat-developer-hub/e2e-test-utils/utils";

const merged = mergeYamlFiles([
  "base-config.yaml",
  "override-config.yaml",
]);
```

### WorkspacePaths

Static utility that resolves workspace config file paths relative to the `e2e-tests/` directory. Used internally by `RHDHDeployment` to locate configuration files.

```typescript
import { WorkspacePaths } from "@red-hat-developer-hub/e2e-test-utils/utils";

WorkspacePaths.e2eRoot       // /abs/path/workspaces/xyz/e2e-tests
WorkspacePaths.workspaceRoot // /abs/path/workspaces/xyz
WorkspacePaths.metadataDir   // /abs/path/workspaces/xyz/metadata
WorkspacePaths.configDir     // /abs/path/workspaces/xyz/e2e-tests/tests/config
WorkspacePaths.appConfig     // .../tests/config/app-config-rhdh.yaml
WorkspacePaths.secrets       // .../tests/config/rhdh-secrets.yaml
WorkspacePaths.dynamicPlugins // .../tests/config/dynamic-plugins.yaml
WorkspacePaths.valueFile     // .../tests/config/value_file.yaml
WorkspacePaths.subscription  // .../tests/config/subscription.yaml
```

Derives paths from Playwright's `test.info().project.testDir`, so it works correctly whether Playwright runs from the workspace root or the repo root.
