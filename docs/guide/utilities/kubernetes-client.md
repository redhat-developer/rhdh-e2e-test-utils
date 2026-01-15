# Kubernetes Client

The `KubernetesClientHelper` class provides a simplified wrapper around the Kubernetes JavaScript client.

## Usage

```typescript
import { KubernetesClientHelper } from "rhdh-e2e-test-utils/utils";

const k8sClient = new KubernetesClientHelper();
```

## Namespace Operations

### `createNamespaceIfNotExists(namespace)`

Create a namespace if it doesn't exist:

```typescript
await k8sClient.createNamespaceIfNotExists("my-namespace");
```

### `deleteNamespace(namespace)`

Delete a namespace:

```typescript
await k8sClient.deleteNamespace("my-namespace");
```

## ConfigMap Operations

### `applyConfigMapFromObject(name, data, namespace)`

Create or update a ConfigMap from an object:

```typescript
await k8sClient.applyConfigMapFromObject(
  "app-config",
  {
    "app-config.yaml": `
      app:
        title: My App
    `,
  },
  "my-namespace"
);
```

### `getConfigMap(name, namespace)`

Get a ConfigMap:

```typescript
const configMap = await k8sClient.getConfigMap("app-config", "my-namespace");
console.log(configMap.data);
```

## Secret Operations

### `applySecretFromObject(name, data, namespace)`

Create or update a Secret:

```typescript
await k8sClient.applySecretFromObject(
  "my-secrets",
  {
    stringData: {
      API_KEY: "secret-value",
      TOKEN: "another-secret",
    },
  },
  "my-namespace"
);
```

## Route Operations

### `getRouteLocation(namespace, routeName)`

Get the URL of an OpenShift Route:

```typescript
const url = await k8sClient.getRouteLocation("my-namespace", "backstage");
// Returns: "https://backstage-my-namespace.apps.cluster.example.com"
```

### `getClusterIngressDomain()`

Get the cluster's ingress domain:

```typescript
const domain = await k8sClient.getClusterIngressDomain();
// Returns: "apps.cluster.example.com"
```

## Deployment Operations

### `scaleDeployment(namespace, name, replicas)`

Scale a deployment:

```typescript
await k8sClient.scaleDeployment("my-namespace", "backstage", 2);
```

### `restartDeployment(namespace, name)`

Restart a deployment (rolling restart):

```typescript
await k8sClient.restartDeployment("my-namespace", "backstage");
```

## Complete Example

```typescript
import { test } from "rhdh-e2e-test-utils/test";

test("kubernetes operations", async ({ rhdh }) => {
  const k8s = rhdh.k8sClient;
  const namespace = rhdh.deploymentConfig.namespace;

  // Create ConfigMap
  await k8s.applyConfigMapFromObject(
    "custom-config",
    { "custom.yaml": "key: value" },
    namespace
  );

  // Create Secret
  await k8s.applySecretFromObject(
    "custom-secrets",
    { stringData: { TOKEN: "secret" } },
    namespace
  );

  // Restart deployment to pick up changes
  await k8s.restartDeployment(namespace, "backstage");

  // Get route URL
  const url = await k8s.getRouteLocation(namespace, "backstage");
  console.log(`RHDH available at: ${url}`);
});
```
