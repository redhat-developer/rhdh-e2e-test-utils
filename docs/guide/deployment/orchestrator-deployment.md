# Orchestrator Deployment

The package provides a script-based installer for the orchestrator (workflows, PostgreSQL, and related resources) in an OpenShift/Kubernetes namespace. Use it when your E2E tests depend on a pre-installed orchestrator in the cluster.

## Overview

`installOrchestrator` runs a bundled shell script that:

1. Ensures the target namespace exists (reuses it if present, creates it if not)
2. Sets the current `oc`/`kubectl` context to that namespace
3. Deploys PostgreSQL, operator, and orchestrator workflows as defined by the script

The script is intended for use in global setup, `beforeAll`, or standalone tooling—not for per-test runs.

## Prerequisites

- OpenShift or Kubernetes cluster and `oc` (or `kubectl`) in `PATH`
- You must be logged in: `oc login` (or equivalent)
- The script expects `bash`

## Basic Usage

```typescript
import installOrchestrator from "@red-hat-developer-hub/e2e-test-utils/orchestrator";

// Use default namespace "orchestrator"
await installOrchestrator();

// Use a custom namespace
await installOrchestrator("my-orchestrator-ns");
```

## Usage in Tests

### Global setup

Run once before all tests:

```typescript
// global-setup.ts
import installOrchestrator from "@red-hat-developer-hub/e2e-test-utils/orchestrator";

export default async function globalSetup() {
  const namespace = process.env.ORCHESTRATOR_NAMESPACE ?? "orchestrator";
  await installOrchestrator(namespace);
}
```

### Before all tests in a file

```typescript
import { test } from "@red-hat-developer-hub/e2e-test-utils/test";
import installOrchestrator from "@red-hat-developer-hub/e2e-test-utils/orchestrator";

test.beforeAll(async () => {
  await installOrchestrator("orchestrator");
});

test("uses orchestrator", async () => {
  // ...
});
```

## Namespace behavior

- If the namespace **does not exist**, it is created and the script continues with deployment.
- If the namespace **already exists**, it is reused (not deleted or recreated). The script configures the context and proceeds with deployment steps that are idempotent where applicable.

This allows reusing the same namespace across runs or sharing it with other tooling.

## Related Pages

- [installOrchestrator API](/api/deployment/orchestrator) - Function signature and options
- [Deployment Overview](/guide/deployment/) - Other deployment options (RHDH, Keycloak)
