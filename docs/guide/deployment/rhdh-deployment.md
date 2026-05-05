# RHDH Deployment

The `RHDHDeployment` class is the core class for managing RHDH deployments in OpenShift.

## Basic Usage

```typescript
import { RHDHDeployment } from "@red-hat-developer-hub/e2e-test-utils/rhdh";

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
import { test } from "@red-hat-developer-hub/e2e-test-utils/test";

test.beforeAll(async ({ rhdh }) => {
  // rhdh is already instantiated with namespace from project name
  await rhdh.configure({ auth: "keycloak" });
  await rhdh.deploy(); // automatically skips if already deployed
});

test("example", async ({ rhdh }) => {
  console.log(`URL: ${rhdh.rhdhUrl}`);
});
```

## Configuration Options

### DeploymentOptions

| Option | Type | Description |
|--------|------|-------------|
| `version` | `string` | RHDH version (e.g., "1.5"). Defaults to `RHDH_VERSION` or `"next"` |
| `namespace` | `string` | Kubernetes namespace. Set via constructor |
| `method` | `"helm" \| "operator"` | Installation method. Defaults to `INSTALLATION_METHOD` or `"helm"` |
| `auth` | `"guest" \| "keycloak"` | Authentication provider. Defaults to `"keycloak"` |
| `appConfig` | `string` | Path to app-config YAML |
| `secrets` | `string` | Path to secrets YAML |
| `dynamicPlugins` | `string` | Path to dynamic-plugins YAML |
| `valueFile` | `string` | Helm values file (Helm only) |
| `subscription` | `string` | Backstage CR file (Operator only) |
| `disableWrappers` | `string[]` | Wrapper plugin package names to disable (`GIT_PR_NUMBER` flows) |
| `useNewFrontendSystem` | `boolean` | Enables the Backstage **new frontend system** shell (app-next / NFS): merges app-next secrets, default OCI **app-auth** and **app-integrations** plugins (as defaults — override in `tests/config/dynamic-plugins.yaml`), and extra Helm values from `config/new-frontend-system/value_file.yaml` plus optional `tests/config/value_file-app-next.yaml`. Omit to **auto-detect**: on when the namespace ends with `-app-next` or `USE_NEW_FRONTEND_SYSTEM=true`. Pass `false` to force off. |

### New frontend system (`useNewFrontendSystem`)

Use the **app-next** frontend when any of these apply:

- You pass `useNewFrontendSystem: true` in **`configure()`** (explicit), or
- The Playwright project name (which becomes the Kubernetes namespace) ends with **`-app-next`**, or
- You set environment variable **`USE_NEW_FRONTEND_SYSTEM=true`**

Pass **`useNewFrontendSystem: false`** to run in a `-app-next` namespace without NFS layers.

Typical explicit flow:

```typescript
await rhdh.configure({
  auth: "keycloak",
  useNewFrontendSystem: true,
});
await rhdh.deploy();
```

With a project named e.g. `my-plugin-app-next`, you can omit the flag and still get NFS merges:

```typescript
await rhdh.configure({ auth: "keycloak" });
await rhdh.deploy();
```

What gets merged (same order as other config: package defaults → auth → NFS defaults → your workspace files; later wins; secrets are merged then **envsubst** runs once on the result):

1. **Secrets** — `APP_CONFIG_app_packageName: app-next` and `ENABLE_STANDARD_MODULE_FEDERATION: "true"` (your `rhdh-secrets.yaml` still wins on conflicts and can use `$VAR` substitution).
2. **Dynamic plugins** — Default OCI refs for `red-hat-developer-hub-backstage-plugin-app-auth` and `...-app-integrations` from package YAML; override pins in **`tests/config/dynamic-plugins.yaml`** (same as other plugins).
3. **Helm** — Package `config/new-frontend-system/value_file.yaml`, then your `value_file.yaml`, then optional `tests/config/value_file-app-next.yaml` when that file exists.

Workspace-specific **app-config** (titles, plugin routes, etc.) remains your responsibility.

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

### `deploy(options?)`

Deploy RHDH to the cluster:

```typescript
await deployment.deploy();
```

The `deploy()` method accepts an optional `{ timeout }` parameter to control the Playwright test timeout during deployment. By default, it sets the timeout to 600 seconds (10 minutes).

```typescript
// Default (600s)
await rhdh.deploy();

// Custom timeout (15 minutes)
await rhdh.deploy({ timeout: 900_000 });

// No timeout (infinite)
await rhdh.deploy({ timeout: 0 });

// Skip — let the consumer control the timeout
test.setTimeout(900_000);
await rhdh.deploy({ timeout: null });
```

`deploy()` automatically skips if the deployment already succeeded in the current test run (e.g., after a worker restart due to test failure). This prevents expensive re-deployments.

This method:
1. Merges configuration files (common → auth → optional NFS defaults → project overrides) for app-config, secrets, and dynamic plugins
2. Substitutes environment variables in the merged secrets (`envsubst`)
3. [Injects plugin metadata](/guide/configuration/config-files#plugin-metadata-injection) into dynamic plugins config
4. Applies ConfigMaps (app-config, dynamic-plugins)
5. Applies Secrets
6. Installs RHDH via Helm or Operator
7. Waits for the deployment to be ready
8. Sets `RHDH_BASE_URL` environment variable

#### Base URL format

The base URL prefix depends on the installation method:

- Helm: `https://redhat-developer-hub-<namespace>.<cluster>`
- Operator: `https://backstage-developer-hub-<namespace>.<cluster>`

#### Helm behavior

Helm deployments perform a scale-down and restart after applying configs to avoid migration locks.

#### Operator version constraints

Operator deployments accept only:

- Semantic versions like `1.5`
- `"next"`

Any other value will throw an error during deployment.

### `waitUntilReady(timeout?)`

Wait for the RHDH deployment to be ready. Performs two-phase readiness check:

1. **Pod readiness** — Waits for all pods to have `Ready=True` with early failure detection (CrashLoopBackOff, ImagePullBackOff, etc.)
2. **Route readiness** — HTTP health check against the RHDH route, closing the gap between pod readiness and the OpenShift Router actually serving traffic

```typescript
// Default timeout: 500 seconds (~8 minutes)
await deployment.waitUntilReady();

// Custom timeout
await deployment.waitUntilReady(600); // 10 minutes
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
You typically don't need to call this manually. In CI, the built-in teardown reporter automatically deletes namespaces after all tests complete. See [Namespace Cleanup](/guide/core-concepts/playwright-fixtures#namespace-cleanup-teardown).
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
import { test } from "@red-hat-developer-hub/e2e-test-utils/test";
import { $ } from "@red-hat-developer-hub/e2e-test-utils/utils";

test.beforeAll(async ({ rhdh }) => {
  // Wrap in test.runOnce because the setup script is also expensive
  await test.runOnce("my-plugin-setup", async () => {
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

    // Deploy RHDH (has built-in protection, safe to nest inside runOnce)
    await rhdh.deploy();
  });
});
```
