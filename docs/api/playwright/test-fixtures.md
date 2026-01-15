# Test Fixtures

Custom Playwright fixtures for RHDH testing.

## Import

```typescript
import { test, expect } from "rhdh-e2e-test-utils/test";
```

## Fixtures

### `rhdh`

**Scope:** Worker

**Type:** `RHDHDeployment`

Shared RHDH deployment across all tests in a worker.

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

## Exported Types

```typescript
import type { Page, BrowserContext, Locator } from "rhdh-e2e-test-utils/test";
```

Re-exports all Playwright types for convenience.

## Complete Example

```typescript
import { test, expect } from "rhdh-e2e-test-utils/test";

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
