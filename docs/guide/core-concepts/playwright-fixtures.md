# Playwright Fixtures

The package extends Playwright's test framework with custom fixtures designed for RHDH testing.

## Importing Fixtures

```typescript
import { test, expect } from "@red-hat-developer-hub/e2e-test-utils/test";
```

This import replaces the standard Playwright import and provides additional fixtures.

## Available Fixtures

| Fixture | Scope | Type | Description |
|---------|-------|------|-------------|
| `rhdh` | worker | `RHDHDeployment` | Shared RHDH deployment across all tests in a worker |
| `uiHelper` | test | `UIhelper` | UI interaction helper for Material-UI components |
| `loginHelper` | test | `LoginHelper` | Authentication helper for various providers |
| `baseURL` | test | `string` | Automatically set to the RHDH instance URL |

## Fixture Scopes

### Worker-Scoped Fixtures

The `rhdh` fixture is worker-scoped, meaning:

- One deployment object is shared across all tests in a worker
- You control *when* deployment happens (usually in `test.beforeAll`)
- All tests in the same worker can share the same RHDH instance

```typescript
test.beforeAll(async ({ rhdh }) => {
  // This runs once per worker
  await rhdh.configure({ auth: "keycloak" });
  await rhdh.deploy();
});
```

### Test-Scoped Fixtures

The `uiHelper`, `loginHelper`, and `baseURL` fixtures are test-scoped:

- Created fresh for each test
- Tied to the test's page instance

```typescript
test("example", async ({ uiHelper, loginHelper }) => {
  // Fresh instances for this test
  await loginHelper.loginAsKeycloakUser();
  await uiHelper.verifyHeading("Welcome");
});
```

## Fixture Details

### `rhdh` Fixture

The `rhdh` fixture provides access to the `RHDHDeployment` instance:

```typescript
test.beforeAll(async ({ rhdh }) => {
  // Configure deployment options
  await rhdh.configure({
    auth: "keycloak",
    appConfig: "tests/config/app-config.yaml",
  });

  // Deploy RHDH
  await rhdh.deploy();
});

test("access deployment info", async ({ rhdh }) => {
  console.log(`URL: ${rhdh.rhdhUrl}`);
  console.log(`Namespace: ${rhdh.deploymentConfig.namespace}`);

  // Access Kubernetes client
  const route = await rhdh.k8sClient.getRouteLocation(
    rhdh.deploymentConfig.namespace,
    "my-route"
  );
});
```

### `uiHelper` Fixture

The `uiHelper` fixture provides UI interaction methods:

```typescript
test("UI interactions", async ({ uiHelper }) => {
  // Wait for page to load
  await uiHelper.waitForLoad();

  // Verify content
  await uiHelper.verifyHeading("Welcome");
  await uiHelper.verifyText("Some content");

  // Navigate
  await uiHelper.openSidebar("Catalog");
  await uiHelper.clickTab("Overview");

  // Interact with forms
  await uiHelper.fillTextInputByLabel("Name", "my-component");
  await uiHelper.clickButton("Submit");
});
```

### `loginHelper` Fixture

The `loginHelper` fixture handles authentication:

```typescript
test.beforeEach(async ({ loginHelper }) => {
  // Guest authentication
  await loginHelper.loginAsGuest();

  // Or Keycloak authentication
  await loginHelper.loginAsKeycloakUser();

  // Or with specific credentials
  await loginHelper.loginAsKeycloakUser("test1", "test1@123");
});

test.afterEach(async ({ loginHelper }) => {
  await loginHelper.signOut();
});
```

### `baseURL` Fixture

The `baseURL` fixture is automatically set to the RHDH URL:

```typescript
test("using baseURL", async ({ page, baseURL }) => {
  // page.goto("/") automatically uses baseURL
  await page.goto("/");

  // Equivalent to:
  await page.goto(baseURL);
});
```

## Namespace Derivation

The namespace for each worker is derived from the Playwright project name:

```typescript
// playwright.config.ts
export default defineConfig({
  projects: [
    { name: "tech-radar" },  // Namespace: tech-radar
    { name: "catalog" },     // Namespace: catalog
  ],
});
```

## Deployment Protection (Built-in)

`rhdh.deploy()` is automatically protected against redundant re-execution. When a test fails and Playwright restarts the worker, `deploy()` detects that the deployment already succeeded and skips — no re-deployment, no wasted time.

This works out of the box. A simple `beforeAll` is all you need:

```typescript
test.beforeAll(async ({ rhdh }) => {
  await rhdh.configure({ auth: "keycloak" });
  await rhdh.deploy(); // runs once, skips on worker restart
});
```

::: tip Why is this needed?
Playwright's `beforeAll` runs once **per worker**, not once per test run. When a test fails, Playwright kills the worker and creates a new one for remaining tests — causing `beforeAll` to run again. Without protection, this would re-deploy RHDH from scratch every time a test fails.
:::

## `test.runOnce` — Run Any Expensive Operation Once

While `rhdh.deploy()` has built-in protection, you may have **other expensive operations** in your `beforeAll` that also shouldn't repeat on worker restart — deploying external services, seeding databases, running setup scripts, etc.

`test.runOnce` ensures any function executes **exactly once per test run**, even across worker restarts:

```typescript
test.beforeAll(async ({ rhdh }) => {
  await test.runOnce("tech-radar-setup", async () => {
    await rhdh.configure({ auth: "keycloak" });
    await $`bash ${setupScript} ${namespace}`;  // expensive external service
    process.env.DATA_URL = await rhdh.k8sClient.getRouteLocation(namespace, "my-service");
    await rhdh.deploy();  // also protected internally, nesting is safe
  });
});
```

### How It Works

- Uses file-based flags scoped to the Playwright runner process
- When a worker restarts after a test failure, `runOnce` detects the flag and skips
- Any state created by the function (deployments, services, data) stays alive
- Flags reset automatically between test runs

### When to Use

| Scenario | What to use |
|----------|------------|
| Just `configure()` + `deploy()` | Nothing extra — `deploy()` is already protected |
| Pre-deploy setup (external services, scripts, env vars) + `deploy()` | Wrap the entire block in `test.runOnce` |
| Multiple independent expensive operations | Use separate `test.runOnce` calls with different keys |

### Examples

**Simple deployment — no `test.runOnce` needed:**

```typescript
test.beforeAll(async ({ rhdh }) => {
  await rhdh.configure({ auth: "keycloak" });
  await rhdh.deploy();
});
```

**Pre-deploy setup — wrap in `test.runOnce`:**

```typescript
test.beforeAll(async ({ rhdh }) => {
  await test.runOnce("tech-radar-full-setup", async () => {
    await rhdh.configure({ auth: "keycloak" });
    await $`bash deploy-external-service.sh ${rhdh.deploymentConfig.namespace}`;
    process.env.DATA_URL = await rhdh.k8sClient.getRouteLocation(
      rhdh.deploymentConfig.namespace, "data-provider"
    );
    await rhdh.deploy();
  });
});
```

**Multiple independent operations with separate keys:**

```typescript
test.describe("Feature A", () => {
  test.beforeAll(async ({ rhdh }) => {
    await test.runOnce("seed-catalog-data", async () => {
      await apiHelper.importEntity("https://example.com/catalog-info.yaml");
    });
  });
});

test.describe("Feature B", () => {
  test.beforeAll(async () => {
    await test.runOnce("deploy-mock-api", async () => {
      await $`bash deploy-mock.sh`;
    });
  });
});
```

### Key: Unique Identifier

The `key` must be globally unique across **all spec files and projects** in the same Playwright run. If two `runOnce` calls in different files use the same key, only the first one will execute. Use a prefix that includes the workspace or project name:

```typescript
// In tech-radar.spec.ts
await test.runOnce("tech-radar-deploy", async () => { ... });
await test.runOnce("tech-radar-data-provider", async () => { ... });

// In catalog.spec.ts
await test.runOnce("catalog-deploy", async () => { ... });
await test.runOnce("catalog-seed-data", async () => { ... });
```

### Nesting

`test.runOnce` can be safely nested. Since `rhdh.deploy()` uses `runOnce` internally, wrapping it in an outer `test.runOnce` is harmless — the outer call skips everything on worker restart, and the inner one never runs:

```typescript
await test.runOnce("full-setup", async () => {
  await $`bash setup.sh`;          // protected by outer runOnce
  await rhdh.deploy();             // has its own internal runOnce (harmless)
});
```

## Namespace Cleanup (Teardown)

In CI environments (`CI=true`), namespaces are automatically deleted after tests complete.

::: info Why a Reporter?
Neither `afterAll` hooks nor worker fixture cleanup can safely handle namespace deletion:

- **`afterAll` hook**: Runs inside a worker process. When a test fails and Playwright restarts the worker for retries, the old worker's `afterAll` fires and deletes the namespace — before the retry worker can use it.
- **Worker fixture teardown**: Same problem — the fixture's teardown callback runs when the worker process exits, which happens on every worker restart (not just at the end of the suite).
- **`globalTeardown`**: Runs after all tests but has no visibility into which projects ran or which namespaces were created.

A **reporter** solves all of these: it runs in the main Playwright process (survives worker restarts), tracks per-project test completion including retries, and only cleans up after a project's last test is truly done.
:::

This is handled by a built-in **teardown reporter** that:

1. Runs in the main Playwright process (survives worker restarts)
2. Tracks test completion **per project** — deletes each project's namespace as soon as all its tests finish, freeing cluster resources early instead of waiting for the entire suite
3. Handles retries correctly — only counts a test as done when it passes, is skipped, or exhausts all retries
4. Provides fallback cleanup in `onEnd` for interrupted runs (e.g., `maxFailures` reached)

### Default Behavior

No configuration needed. The namespace is derived from your project name:

```typescript
// playwright.config.ts
projects: [
  { name: "tech-radar" },   // Namespace "tech-radar" deleted after all tests
  { name: "catalog" },      // Namespace "catalog" deleted after all tests
]
```

### Custom Namespaces

If you deploy to a namespace that differs from the project name, register it for cleanup:

```typescript
import { registerTeardownNamespace } from "@red-hat-developer-hub/e2e-test-utils/teardown";

test.beforeAll(async ({ rhdh }) => {
  await rhdh.configure({ namespace: "my-custom-ns", auth: "keycloak" });
  await rhdh.deploy();
  registerTeardownNamespace("my-project", "my-custom-ns");
});
```

Multiple namespaces per project are supported — all registered namespaces are deleted after that project's tests complete.

### Local Development

Namespaces are **not** deleted locally (only in CI). This preserves deployments for debugging.

## Best Practices for Projects and Spec Files

Each Playwright project name creates a **separate namespace**. The fixture creates one `RHDHDeployment` per worker, and you typically call `rhdh.deploy()` once in `beforeAll`.

**Recommended for overlay workspaces:**

- Use **one Playwright project** named after the workspace.
- Keep **one spec file** per workspace unless you have a strong reason to split.

This keeps deployment cost low and avoids multiple namespaces unless required.

## When You Need Multiple Projects or Spec Files

If requirements differ (different auth, configs, or namespaces), you can:

1. **Use multiple projects** with different names and config overrides.
2. **Manually manage deployments** using `RHDHDeployment` for advanced flows.

Example using multiple projects:

```typescript
export default defineConfig({
  projects: [
    { name: "workspace-default" },
    { name: "workspace-guest" },
  ],
});
```

Example with manual deployment:

```typescript
import { RHDHDeployment } from "@red-hat-developer-hub/e2e-test-utils/rhdh";

test.beforeAll(async () => {
  const rhdh = new RHDHDeployment("custom-namespace");
  await rhdh.configure({ auth: "guest" });
  await rhdh.deploy();
});
```

## Example: Complete Test Setup

```typescript
import { test, expect } from "@red-hat-developer-hub/e2e-test-utils/test";

test.describe("My Plugin Tests", () => {
  test.beforeAll(async ({ rhdh }) => {
    await rhdh.configure({
      auth: "keycloak",
      appConfig: "tests/config/app-config.yaml",
      dynamicPlugins: "tests/config/plugins.yaml",
    });
    await rhdh.deploy();
  });

  test.beforeEach(async ({ page, loginHelper }) => {
    await page.goto("/");
    await loginHelper.loginAsKeycloakUser();
  });

  test("should display heading", async ({ uiHelper }) => {
    await uiHelper.openSidebar("My Plugin");
    await uiHelper.verifyHeading("My Plugin");
  });

  test("should show data", async ({ uiHelper }) => {
    await uiHelper.openSidebar("My Plugin");
    await uiHelper.verifyRowsInTable(["Item 1", "Item 2"]);
  });
});
```
