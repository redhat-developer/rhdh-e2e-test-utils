# installOrchestrator

Runs the bundled orchestrator install script in the given OpenShift/Kubernetes namespace. The script ensures the namespace exists (reuses or creates), sets the current context, and deploys PostgreSQL, operator, and orchestrator workflows.

## Import

```typescript
import installOrchestrator from "@red-hat-developer-hub/e2e-test-utils/orchestrator";
```

Named import is also supported:

```typescript
import { installOrchestrator } from "@red-hat-developer-hub/e2e-test-utils/orchestrator";
```

## Function

### `installOrchestrator(namespace?)`

```typescript
function installOrchestrator(namespace?: string): Promise<void>
```

| Parameter   | Type     | Default         | Description                          |
| ----------- | -------- | --------------- | ------------------------------------ |
| `namespace` | `string` | `"orchestrator"` | Target OpenShift/Kubernetes namespace |

**Returns:** `Promise<void>` — Resolves when the script completes successfully; rejects on script failure or if not logged into a cluster.

## Example

```typescript
import installOrchestrator from "@red-hat-developer-hub/e2e-test-utils/orchestrator";

await installOrchestrator();                    // uses namespace "orchestrator"
await installOrchestrator("my-e2e-orchestrator");
```

## Requirements

- Cluster access: `oc` (or `kubectl`) in `PATH` and already logged in
- The script runs in the same process (blocking until the shell script exits)

## Related Pages

- [Orchestrator Deployment (Guide)](/guide/deployment/orchestrator-deployment) - Usage patterns and prerequisites
