# RHDH Deployment

The `RHDHDeployment` class is the core class for managing RHDH deployments in OpenShift.

## Basic Usage

```typescript
import { RHDHDeployment } from "rhdh-e2e-test-utils/rhdh";

// Create deployment with namespace
const deployment = new RHDHDeployment("my-test-namespace");

// Configure options
await deployment.configure({
  version: "1.5",
  method: "helm",
  auth: "keycloak",
});

// Deploy RHDH
await deployment.deploy();

// Access the deployed instance
console.log(`RHDH URL: ${deployment.rhdhUrl}`);
```

## Using with Test Fixtures

When using the test fixtures, `RHDHDeployment` is automatically created:

```typescript
import { test } from "rhdh-e2e-test-utils/test";

test.beforeAll(async ({ rhdh }) => {
  // rhdh is already instantiated with namespace from project name
  await rhdh.configure({ auth: "keycloak" });
  await rhdh.deploy();
});

test("example", async ({ rhdh }) => {
  console.log(`URL: ${rhdh.rhdhUrl}`);
});
```

## Configuration Options

### DeploymentOptions

| Option | Type | Description |
|--------|------|-------------|
| `version` | `string` | RHDH version (e.g., "1.5"). Defaults to `RHDH_VERSION` env var |
| `namespace` | `string` | Kubernetes namespace. Set via constructor |
| `method` | `"helm" \| "operator"` | Installation method. Defaults to `INSTALLATION_METHOD` env var |
| `auth` | `"guest" \| "keycloak"` | Authentication provider. Defaults to `"keycloak"` |
| `appConfig` | `string` | Path to app-config YAML |
| `secrets` | `string` | Path to secrets YAML |
| `dynamicPlugins` | `string` | Path to dynamic-plugins YAML |
| `valueFile` | `string` | Helm values file (Helm only) |
| `subscription` | `string` | Backstage CR file (Operator only) |

### Example: Full Configuration

```typescript
await deployment.configure({
  version: "1.5",
  method: "helm",
  auth: "keycloak",
  appConfig: "tests/config/app-config-rhdh.yaml",
  secrets: "tests/config/rhdh-secrets.yaml",
  dynamicPlugins: "tests/config/dynamic-plugins.yaml",
  valueFile: "tests/config/value_file.yaml",
});
```

## Methods

### `configure(options?)`

Prepare for deployment by creating the namespace and setting options:

```typescript
await deployment.configure({
  auth: "keycloak",
  appConfig: "tests/config/app-config.yaml",
});
```

### `deploy()`

Deploy RHDH to the cluster:

```typescript
await deployment.deploy();
```

This method:
1. Merges configuration files (common → auth → project)
2. Applies ConfigMaps (app-config, dynamic-plugins)
3. Applies Secrets (with environment variable substitution)
4. Installs RHDH via Helm or Operator
5. Waits for the deployment to be ready
6. Sets `RHDH_BASE_URL` environment variable

### `waitUntilReady(timeout?)`

Wait for the RHDH deployment to be ready:

```typescript
// Default timeout: 300000ms (5 minutes)
await deployment.waitUntilReady();

// Custom timeout
await deployment.waitUntilReady(600000); // 10 minutes
```

### `rolloutRestart()`

Restart the RHDH deployment (useful after config changes):

```typescript
// Update configuration
await deployment.k8sClient.applyConfigMapFromObject(
  "app-config-rhdh",
  { newConfig: "value" },
  deployment.deploymentConfig.namespace
);

// Restart to apply changes
await deployment.rolloutRestart();
```

### `teardown()`

Delete the namespace and all resources:

```typescript
await deployment.teardown();
```

::: warning
This permanently deletes all resources in the namespace. In CI, this happens automatically.
:::

## Properties

### `rhdhUrl`

The URL of the deployed RHDH instance:

```typescript
const url = deployment.rhdhUrl;
// e.g., "https://backstage-my-namespace.apps.cluster.example.com"
```

### `deploymentConfig`

The current deployment configuration:

```typescript
const config = deployment.deploymentConfig;
console.log(config.namespace);  // "my-namespace"
console.log(config.version);    // "1.5"
console.log(config.method);     // "helm"
console.log(config.auth);       // "keycloak"
```

### `k8sClient`

The Kubernetes client instance for direct cluster operations:

```typescript
const k8s = deployment.k8sClient;

// Get route URL
const url = await k8s.getRouteLocation(
  deployment.deploymentConfig.namespace,
  "my-route"
);

// Apply custom ConfigMap
await k8s.applyConfigMapFromObject(
  "my-config",
  { key: "value" },
  deployment.deploymentConfig.namespace
);
```

## Configuration File Paths

Configuration files are looked for in:

```
tests/config/
├── app-config-rhdh.yaml
├── dynamic-plugins.yaml
└── rhdh-secrets.yaml
```

Or specify custom paths:

```typescript
await deployment.configure({
  appConfig: "custom/path/app-config.yaml",
  secrets: "custom/path/secrets.yaml",
  dynamicPlugins: "custom/path/plugins.yaml",
});
```

## Configuration Merging Order

1. **Common configs** (`package/config/common/`)
2. **Auth configs** (`package/config/auth/{guest|keycloak}/`)
3. **Project configs** (your `tests/config/` files)

Later files override earlier ones, allowing you to customize only what you need.

## Example: Pre-Deployment Setup

```typescript
import { test } from "rhdh-e2e-test-utils/test";
import { $ } from "rhdh-e2e-test-utils/utils";

test.beforeAll(async ({ rhdh }) => {
  const namespace = rhdh.deploymentConfig.namespace;

  // Configure RHDH
  await rhdh.configure({ auth: "keycloak" });

  // Run custom setup before deployment
  await $`bash scripts/setup.sh ${namespace}`;

  // Set runtime environment variables
  process.env.MY_CUSTOM_URL = await rhdh.k8sClient.getRouteLocation(
    namespace,
    "my-service"
  );

  // Deploy RHDH (uses env vars set above)
  await rhdh.deploy();
});
```
