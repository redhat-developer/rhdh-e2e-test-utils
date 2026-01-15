# RHDHDeployment

Class for managing RHDH deployments in OpenShift.

## Import

```typescript
import { RHDHDeployment } from "rhdh-e2e-test-utils/rhdh";
```

## Constructor

```typescript
new RHDHDeployment(namespace: string)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `namespace` | `string` | Kubernetes namespace for deployment |

## Properties

### `rhdhUrl`

```typescript
get rhdhUrl(): string
```

The URL of the deployed RHDH instance.

### `deploymentConfig`

```typescript
get deploymentConfig(): DeploymentConfig
```

Current deployment configuration. See [Deployment Types](/api/deployment/deployment-types).

### `k8sClient`

```typescript
get k8sClient(): KubernetesClientHelper
```

Kubernetes client instance for direct cluster operations.

## Methods

### `configure()`

```typescript
async configure(options?: DeploymentOptions): Promise<void>
```

Configure deployment options and create namespace.

| Parameter | Type | Description |
|-----------|------|-------------|
| `options` | `DeploymentOptions` | Optional deployment configuration |

```typescript
await rhdh.configure({
  version: "1.5",
  method: "helm",
  auth: "keycloak",
  appConfig: "tests/config/app-config.yaml",
});
```

### `deploy()`

```typescript
async deploy(): Promise<void>
```

Deploy RHDH to the cluster. This:
1. Merges configuration files
2. Applies ConfigMaps and Secrets
3. Installs RHDH via Helm or Operator
4. Waits for deployment to be ready

```typescript
await rhdh.deploy();
```

### `waitUntilReady()`

```typescript
async waitUntilReady(timeout?: number): Promise<void>
```

Wait for RHDH deployment to be ready.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `timeout` | `number` | `300000` | Timeout in milliseconds |

```typescript
await rhdh.waitUntilReady(600000); // 10 minutes
```

### `rolloutRestart()`

```typescript
async rolloutRestart(): Promise<void>
```

Restart the RHDH deployment.

```typescript
await rhdh.rolloutRestart();
```

### `scaleDownAndRestart()`

```typescript
async scaleDownAndRestart(): Promise<void>
```

Scale down to 0, then back to 1 replica.

```typescript
await rhdh.scaleDownAndRestart();
```

### `teardown()`

```typescript
async teardown(): Promise<void>
```

Delete the namespace and all resources.

```typescript
await rhdh.teardown();
```

## Example

```typescript
import { RHDHDeployment } from "rhdh-e2e-test-utils/rhdh";

const rhdh = new RHDHDeployment("my-namespace");

await rhdh.configure({
  version: "1.5",
  method: "helm",
  auth: "keycloak",
  appConfig: "tests/config/app-config.yaml",
  secrets: "tests/config/secrets.yaml",
  dynamicPlugins: "tests/config/plugins.yaml",
  valueFile: "tests/config/values.yaml",
});

await rhdh.deploy();

console.log(`RHDH deployed at: ${rhdh.rhdhUrl}`);

// After tests
await rhdh.teardown();
```
