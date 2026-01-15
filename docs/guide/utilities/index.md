# Utilities Overview

The package provides utility functions for common operations in E2E testing.

## Available Utilities

| Utility | Purpose |
|---------|---------|
| [KubernetesClientHelper](/guide/utilities/kubernetes-client) | Kubernetes API operations |
| [Bash ($)](/guide/utilities/bash-utilities) | Shell command execution |
| [YAML Merging](/guide/utilities/yaml-merging) | Merge YAML files |
| [envsubst](/guide/utilities/environment-substitution) | Environment variable substitution |

## Importing Utilities

```typescript
import {
  $,
  KubernetesClientHelper,
  envsubst,
  mergeYamlFiles,
  mergeYamlFilesToFile,
} from "rhdh-e2e-test-utils/utils";
```

## Quick Examples

### Bash Commands

```typescript
import { $ } from "rhdh-e2e-test-utils/utils";

// Execute commands
await $`oc get pods -n my-namespace`;

// Capture output
const result = await $`oc get pods -o json`;
console.log(result.stdout);
```

### Kubernetes Operations

```typescript
import { KubernetesClientHelper } from "rhdh-e2e-test-utils/utils";

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
import { envsubst } from "rhdh-e2e-test-utils/utils";

const template = "API URL: ${API_URL:-http://localhost}";
const result = envsubst(template);
// Result: "API URL: http://localhost" (if API_URL not set)
```

### YAML Merging

```typescript
import { mergeYamlFiles } from "rhdh-e2e-test-utils/utils";

const merged = mergeYamlFiles([
  "base-config.yaml",
  "override-config.yaml",
]);
```
