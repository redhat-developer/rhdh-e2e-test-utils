# Test Fixtures

Custom Playwright fixtures for RHDH testing.

## Import

```typescript
import { test, expect } from "@red-hat-developer-hub/e2e-test-utils/test";
```

## Fixtures

### `rhdh`

**Scope:** Worker

**Type:** `RHDHDeployment`

Shared RHDH deployment across all tests in a worker. `deploy()` automatically skips if the deployment already succeeded, even after worker restarts.

```typescript
test.beforeAll(async ({ rhdh }) => {
  await rhdh.configure({ auth: "keycloak" });
  await rhdh.deploy();
});

test("access rhdh", async ({ rhdh }) => {
  console.log(rhdh.rhdhUrl);
  console.log(rhdh.deploymentConfig.namespace);
});
```

### `uiHelper`

**Scope:** Test

**Type:** `UIhelper`

UI interaction helper for Material-UI components.

```typescript
test("ui interactions", async ({ uiHelper }) => {
  await uiHelper.verifyHeading("Welcome");
  await uiHelper.clickButton("Submit");
  await uiHelper.openSidebar("Catalog");
});
```

### `loginHelper`

**Scope:** Test

**Type:** `LoginHelper`

Authentication helper for various providers.

```typescript
test.beforeEach(async ({ loginHelper }) => {
  await loginHelper.loginAsKeycloakUser();
});

test.afterEach(async ({ loginHelper }) => {
  await loginHelper.signOut();
});
```

### `baseURL`

**Scope:** Test

**Type:** `string`

Automatically set to the RHDH instance URL.

```typescript
test("using baseURL", async ({ page, baseURL }) => {
  console.log(`Base URL: ${baseURL}`);
  // page.goto("/") uses this automatically
  await page.goto("/");
});
```

## `test.runOnce`

```typescript
test.runOnce(
  key: string,
  fn: () => Promise<void> | void,
  options?: { scope?: "run" | "project"; project?: string },
): Promise<boolean>
```

Executes `fn` exactly once, even across worker restarts. Returns `true` if executed, `false` if skipped.

::: tip
`rhdh.deploy()` already uses `runOnce` internally, so you don't need to wrap simple deployments. Use `test.runOnce` when you have **additional expensive operations** (external services, scripts, data seeding) alongside `deploy()`.
:::

| Parameter | Type | Description |
|-----------|------|-------------|
| `key` | `string` | Identifier for this operation, unique across all spec files |
| `fn` | `() => Promise<void> \| void` | Function to execute once |
| `options.scope` | `"run" \| "project"` | `"run"` (default) executes once for the whole run, every project included. `"project"` executes once per Playwright project — required for anything touching that project's namespace or deployment |
| `options.project` | `string` | Defaults to the calling test's project. Pass explicitly outside a Playwright context; with `scope: "project"` and no context, `runOnce` throws rather than silently sharing one key |

::: warning Two projects, one key
A Playwright project is a namespace and a deployment of its own. When one spec is matched by more than one project — what adding an `-app-next` lane does — a run-scoped key means the second project skips setup the first already did, with no error and an empty page much later. Use `{ scope: "project" }` for per-project setup. Since 2.1.10 a key with no declared scope that is skipped for a *different* project logs a `[runOnce]` warning naming both.
:::

```typescript
// Wrap pre-deploy setup that shouldn't repeat.
// scope: "project" — everything inside belongs to this project's namespace.
test.beforeAll(async ({ rhdh }) => {
  await test.runOnce("full-setup", async () => {
    await $`bash deploy-external-service.sh`;
    await rhdh.configure({ auth: "keycloak" });
    await rhdh.deploy(); // safe to nest, has its own internal protection
  }, { scope: "project" });
});
```

See [Deployment Protection](/guide/core-concepts/playwright-fixtures#deployment-protection-built-in) and [`test.runOnce`](/guide/core-concepts/playwright-fixtures#test-runonce-—-run-any-expensive-operation-once) for details.

## Exported Types

```typescript
import type { Page, BrowserContext, Locator } from "@red-hat-developer-hub/e2e-test-utils/test";
```

Re-exports all Playwright types for convenience.

## Complete Example

```typescript
import { test, expect } from "@red-hat-developer-hub/e2e-test-utils/test";

test.describe("My Tests", () => {
  test.beforeAll(async ({ rhdh }) => {
    await rhdh.configure({ auth: "keycloak" });
    await rhdh.deploy();
  });

  test.beforeEach(async ({ page, loginHelper }) => {
    await page.goto("/");
    await loginHelper.loginAsKeycloakUser();
  });

  test("verify heading", async ({ uiHelper }) => {
    await uiHelper.verifyHeading("Red Hat Developer Hub");
  });

  test("navigate to catalog", async ({ page, uiHelper }) => {
    await uiHelper.openSidebar("Catalog");
    await expect(page).toHaveURL(/.*catalog/);
  });
});
```
