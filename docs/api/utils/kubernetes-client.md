# KubernetesClientHelper API

Kubernetes API wrapper for OpenShift operations.

## Import

```typescript
import { KubernetesClientHelper } from "rhdh-e2e-test-utils/utils";
```

## Constructor

```typescript
new KubernetesClientHelper()
```

## Methods

### Namespace

#### `createNamespaceIfNotExists()`
```typescript
async createNamespaceIfNotExists(namespace: string): Promise<void>
```

#### `deleteNamespace()`
```typescript
async deleteNamespace(namespace: string): Promise<void>
```

### ConfigMap

#### `applyConfigMapFromObject()`
```typescript
async applyConfigMapFromObject(
  name: string,
  data: Record<string, string>,
  namespace: string
): Promise<void>
```

#### `getConfigMap()`
```typescript
async getConfigMap(name: string, namespace: string): Promise<V1ConfigMap>
```

### Secret

#### `applySecretFromObject()`
```typescript
async applySecretFromObject(
  name: string,
  data: { stringData?: Record<string, string> },
  namespace: string
): Promise<void>
```

#### `getSecret()`
```typescript
async getSecret(name: string, namespace: string): Promise<V1Secret>
```

### Route

#### `getRouteLocation()`
```typescript
async getRouteLocation(namespace: string, routeName: string): Promise<string>
```

#### `getClusterIngressDomain()`
```typescript
async getClusterIngressDomain(): Promise<string>
```

### Deployment

#### `scaleDeployment()`
```typescript
async scaleDeployment(
  namespace: string,
  name: string,
  replicas: number
): Promise<void>
```

#### `restartDeployment()`
```typescript
async restartDeployment(namespace: string, name: string): Promise<void>
```

## Example

```typescript
import { KubernetesClientHelper } from "rhdh-e2e-test-utils/utils";

const k8s = new KubernetesClientHelper();

await k8s.createNamespaceIfNotExists("my-ns");
await k8s.applyConfigMapFromObject("config", { key: "value" }, "my-ns");
const url = await k8s.getRouteLocation("my-ns", "my-route");
```
