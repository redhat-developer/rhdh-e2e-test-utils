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

Shared RHDH deployment across all tests in a worker. `deploy()` automatically skips if the deployment already succeeded, even after worker restarts. Use `deploy({ force: true })` to bypass this protection when you need to redeploy with different configurations in the same test file.

```typescript
test.beforeAll(async ({ rhdh }) => {
  await rhdh.configure({ auth: "keycloak" });
  await rhdh.deploy();
});

test("access rhdh", async ({ rhdh }) => {
  console.log(rhdh.rhdhUrl);
  console.log(rhdh.deploymentConfig.namespace);
});

// Force redeploy with new config
test.describe("Different Config", () => {
  test.beforeAll(async ({ rhdh }) => {
    await rhdh.configure({ appConfig: "tests/config/new-app-config-rhdh.yaml" });
    await rhdh.deploy({ force: true });
  });
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
test.runOnce(key: string, fn: () => Promise<void> | void): Promise<boolean>
```

Executes `fn` exactly once per test run, even across worker restarts. Returns `true` if executed, `false` if skipped.

::: tip
`rhdh.deploy()` already uses `runOnce` internally, so you don't need to wrap simple deployments. Use `test.runOnce` when you have **additional expensive operations** (external services, scripts, data seeding) alongside `deploy()`.
:::

| Parameter | Type | Description |
|-----------|------|-------------|
| `key` | `string` | Unique identifier for this operation |
| `fn` | `() => Promise<void> \| void` | Function to execute once |

```typescript
// Wrap pre-deploy setup that shouldn't repeat
test.beforeAll(async ({ rhdh }) => {
  await test.runOnce("full-setup", async () => {
    await $`bash deploy-external-service.sh`;
    await rhdh.configure({ auth: "keycloak" });
    await rhdh.deploy(); // safe to nest, has its own internal protection
  });
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
