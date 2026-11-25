# Kubernetes Client

The `KubernetesClientHelper` class provides a simplified wrapper around the Kubernetes JavaScript client.

## Usage

```typescript
import { KubernetesClientHelper } from "@red-hat-developer-hub/e2e-test-utils/utils";

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

## Pod Operations

### `waitForPodsWithFailureDetection(namespace, labelSelector, timeout?, pollInterval?)`

Wait for pods to be ready with early failure detection. Unlike `oc rollout status`, this method detects unrecoverable failure states (CrashLoopBackOff, ImagePullBackOff, etc.) within seconds and fails fast with container logs:

```typescript
await k8sClient.waitForPodsWithFailureDetection(
  "my-namespace",
  "app.kubernetes.io/instance=my-app",
  500,  // timeout in seconds (default: 500)
  5000  // poll interval in ms (default: 5000)
);
```

**Detected failure states:**
- `CrashLoopBackOff` - container keeps crashing
- `ImagePullBackOff` / `ErrImagePull` - can't pull image. Throttled pulls are not treated as failures, because the kubelet retries them: the method logs the throttled container once and keeps waiting until the timeout. Throttling means `pull QPS exceeded` (the node's kubelet pull limit) or a registry rate limit (`too many requests to registry` on CRI-O, `429 Too Many Requests` on containerd, `toomanyrequests`). `ImagePullBackOff` carries the pull error only on Kubernetes 1.32 and later; on older clusters a throttled pull still fails fast once it reaches back-off
- `CreateContainerConfigError` - config issues (missing secrets, etc.)
- `Init:*` variants - init container failures

When a failure is detected, the method:
1. Logs the failure reason
2. Fetches container logs via `oc logs`
3. Throws an error with the failure details

## Diagnostic Log Collection

### `collectDiagnosticLogs(namespace, outputDir?)`

Collects comprehensive cluster diagnostics and saves them to files. Uses `kubectl` for cross-platform compatibility (OpenShift, EKS, GKE, etc.). OpenShift-specific resources (routes) are collected on a best-effort basis.

```typescript
await k8sClient.collectDiagnosticLogs("my-namespace");
// Saves to: node_modules/.cache/e2e-test-results/logs/my-namespace/

// Or with a custom output directory:
await k8sClient.collectDiagnosticLogs("my-namespace", "/tmp/debug-logs");
```

**Collected resources:**

| File | Content |
|------|---------|
| `events.txt` | Namespace events sorted by timestamp |
| `pods.txt` | Pod status (`kubectl get pods -o wide`) |
| `describe-pods.txt` | Full pod descriptions |
| `deployments.txt` | Deployment status |
| `describe-deployments.txt` | Full deployment descriptions |
| `statefulsets.txt` | StatefulSet status |
| `routes.txt` | OpenShift routes (skipped on non-OpenShift clusters) |
| `pods/<pod>/<container>.log` | Current logs per container (init + app) |
| `pods/<pod>/<container>.previous.log` | Previous restart logs (only if pod restarted) |

**Key behaviors:**
- Logs are collected per-container rather than `--all-containers`, so a failed init container doesn't block collection of other container logs
- Empty files are not created (e.g., when there are no previous logs)
- Resource types that don't exist on the cluster (e.g., routes on non-OpenShift) are silently skipped
- All resource collection runs in parallel via `Promise.allSettled`

**Automatic collection on test failure:**

In the overlay testing flow, you don't need to call this manually. The built-in `TeardownReporter` automatically calls `collectDiagnosticLogs` for any project that had test failures. This works on both CI and local runs.

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
import { test } from "@red-hat-developer-hub/e2e-test-utils/test";

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
