# Pre-requisite Services

::: tip Overlay Documentation
This page covers writing tests within rhdh-plugin-export-overlays.
For using @red-hat-developer-hub/e2e-test-utils in external projects, see the [Guide](/guide/).
:::

Some plugins require external services or dependencies to be running before RHDH starts. This page explains how to handle such pre-requisites.

## When You Need This

Your plugin tests may require pre-requisites when:

- Plugin reads data from an external API or service
- Plugin requires a database or storage backend
- Plugin integrates with third-party services
- Test fixtures must be deployed to the cluster before RHDH starts

## The Pattern

Deploy pre-requisites **after** `rhdh.configure()` but **before** `rhdh.deploy()`. Since these operations are expensive and create persistent cluster resources, wrap the entire block in `test.runOnce` to prevent re-execution on worker restarts:

```typescript
test.beforeAll(async ({ rhdh }) => {
  await test.runOnce("my-plugin-setup", async () => {
    const project = rhdh.deploymentConfig.namespace;

    // 1. Configure RHDH first
    await rhdh.configure({ auth: "keycloak" });

    // 2. Deploy pre-requisite service (see examples below)
    // ...

    // 3. Set environment variable if needed for RHDH config
    process.env.MY_SERVICE_URL = "...";

    // 4. Deploy RHDH (uses the environment variable)
    await rhdh.deploy();
  });
});
```

::: tip When is `test.runOnce` needed?
`rhdh.deploy()` already skips automatically on worker restarts. But the pre-deploy steps (deploying external services, running scripts) don't have this protection. `test.runOnce` ensures the **entire setup** runs only once. The `key` must be **globally unique** across all spec files and projects in the same Playwright run — prefix it with your workspace name (e.g., `"tech-radar-setup"`). See [`test.runOnce`](/guide/core-concepts/playwright-fixtures#test-runonce-—-run-any-expensive-operation-once) for details.
:::

## Examples

### Using TypeScript / k8sClient

You can deploy pre-requisites directly in TypeScript using the Kubernetes client:

```typescript
import { test } from "@red-hat-developer-hub/e2e-test-utils/test";

test.beforeAll(async ({ rhdh }) => {
  await test.runOnce("my-plugin-k8s-setup", async () => {
    const project = rhdh.deploymentConfig.namespace;
    const k8s = rhdh.k8sClient;

    await rhdh.configure({ auth: "keycloak" });

    // Create a ConfigMap
    await k8s.applyConfigMapFromObject(
      "my-config",
      { "config.json": JSON.stringify({ key: "value" }) },
      project,
    );

    // Create a Secret
    await k8s.applySecretFromObject(
      "my-secret",
      { stringData: { API_KEY: process.env.VAULT_API_KEY } },
      project,
    );

    await rhdh.deploy();
  });
});
```

### Using Shell Commands

For OpenShift-specific operations, use the `$` utility:

```typescript
import { test } from "@red-hat-developer-hub/e2e-test-utils/test";
import { $ } from "@red-hat-developer-hub/e2e-test-utils/utils";

test.beforeAll(async ({ rhdh }) => {
  await test.runOnce("my-plugin-oc-setup", async () => {
    const project = rhdh.deploymentConfig.namespace;

    await rhdh.configure({ auth: "keycloak" });

    // Deploy an app from image
    await $`oc new-app my-image:tag --name=my-service --namespace=${project}`;
    await $`oc expose svc/my-service --namespace=${project}`;

    // Get service URL
    process.env.MY_SERVICE_URL = await rhdh.k8sClient.getRouteLocation(
      project,
      "my-service",
    );

    await rhdh.deploy();
  });
});
```

### Using a Script File

For complex deployments, you can use a separate script file:

```typescript
import { $ } from "@red-hat-developer-hub/e2e-test-utils/utils";
import path from "path";

const setupScript = path.join(import.meta.dirname, "deploy-service.sh");

test.beforeAll(async ({ rhdh }) => {
  await test.runOnce("my-plugin-script-setup", async () => {
    const project = rhdh.deploymentConfig.namespace;

    await rhdh.configure({ auth: "keycloak" });
    await $`bash ${setupScript} ${project}`;
    await rhdh.deploy();
  });
});
```

## Real Example: Tech Radar

The tech-radar plugin requires an external data provider:

```typescript
test.beforeAll(async ({ rhdh }) => {
  await test.runOnce("tech-radar-setup", async () => {
    const project = rhdh.deploymentConfig.namespace;

    await rhdh.configure({ auth: "keycloak" });

    // Deploy the data provider service
    await $`bash ${setupScript} ${project}`;

    // Get URL and set as env var for rhdh-secrets.yaml substitution
    process.env.TECH_RADAR_DATA_URL = (
      await rhdh.k8sClient.getRouteLocation(
        project,
        "test-backstage-customization-provider",
      )
    ).replace("http://", "");

    await rhdh.deploy();
  });
});
```

## Related Pages

- [Spec Files](/overlay/test-structure/spec-files) - Test file structure
- [Configuration Files](/overlay/test-structure/configuration-files) - Using environment variables in configs
- [Tech Radar Example](/overlay/examples/tech-radar) - Complete example with pre-requisites
