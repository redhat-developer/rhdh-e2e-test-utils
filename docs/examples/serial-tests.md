# Serial Tests

Example using shared browser session across tests.

## Why Serial Tests?

- Avoid repeated logins
- Maintain state between tests
- Faster test execution
- Test multi-step workflows

## Basic Serial Tests

```typescript
import { test } from "@playwright/test";
import { setupBrowser, LoginHelper, UIhelper } from "rhdh-e2e-test-utils/helpers";
import type { Page, BrowserContext } from "@playwright/test";

// Configure serial mode
test.describe.configure({ mode: "serial" });

let page: Page;
let context: BrowserContext;
let uiHelper: UIhelper;

test.beforeAll(async ({ browser }, testInfo) => {
  // Setup shared browser with video recording
  ({ page, context } = await setupBrowser(browser, testInfo));

  // Create helpers
  uiHelper = new UIhelper(page);
  const loginHelper = new LoginHelper(page);

  // Login once
  await page.goto("/");
  await loginHelper.loginAsKeycloakUser();
});

test.afterAll(async () => {
  await context.close();
});

test("step 1: navigate to catalog", async () => {
  await uiHelper.openSidebar("Catalog");
  await uiHelper.verifyHeading("Catalog");
});

test("step 2: search for component", async () => {
  // Still on catalog page from step 1
  await uiHelper.searchInputPlaceholder("Filter", "example");
  await uiHelper.verifyRowsInTable(["example-component"]);
});

test("step 3: view component details", async () => {
  // Click on component found in step 2
  await page.click("text=example-component");
  await uiHelper.verifyHeading("example-component");
});

test("step 4: navigate tabs", async () => {
  // Still on component page from step 3
  await uiHelper.clickTab("Dependencies");
  await uiHelper.clickTab("API");
  await uiHelper.clickTab("Overview");
});
```

## Multi-Step Workflow

```typescript
import { test, expect } from "@playwright/test";
import { setupBrowser, LoginHelper, UIhelper } from "rhdh-e2e-test-utils/helpers";
import { CatalogImportPage } from "rhdh-e2e-test-utils/pages";
import type { Page, BrowserContext } from "@playwright/test";

test.describe.configure({ mode: "serial" });

let page: Page;
let context: BrowserContext;
const componentUrl = "https://github.com/org/repo/blob/main/catalog-info.yaml";

test.beforeAll(async ({ browser }, testInfo) => {
  ({ page, context } = await setupBrowser(browser, testInfo));

  const loginHelper = new LoginHelper(page);
  await page.goto("/");
  await loginHelper.loginAsKeycloakUser();
});

test.afterAll(async () => {
  await context.close();
});

test("register component", async () => {
  const importPage = new CatalogImportPage(page);
  await importPage.go();
  await importPage.registerExistingComponent(componentUrl);
});

test("verify in catalog", async () => {
  const uiHelper = new UIhelper(page);
  await uiHelper.openSidebar("Catalog");
  await uiHelper.verifyRowsInTable(["my-component"]);
});

test("view component details", async () => {
  await page.click("text=my-component");
  const uiHelper = new UIhelper(page);
  await uiHelper.verifyHeading("my-component");
});

test("check dependencies tab", async () => {
  const uiHelper = new UIhelper(page);
  await uiHelper.clickTab("Dependencies");
  await expect(page.getByText("Dependencies")).toBeVisible();
});
```

## With Deployment

```typescript
import { test as base } from "@playwright/test";
import { RHDHDeployment } from "rhdh-e2e-test-utils/rhdh";
import { setupBrowser, LoginHelper, UIhelper } from "rhdh-e2e-test-utils/helpers";
import type { Page, BrowserContext } from "@playwright/test";

// Create custom test with deployment
const test = base.extend<{}, { deployment: RHDHDeployment }>({
  deployment: [async ({}, use) => {
    const rhdh = new RHDHDeployment("serial-tests");
    await rhdh.configure({ auth: "keycloak" });
    await rhdh.deploy();

    await use(rhdh);

    // Cleanup after all tests
    // await rhdh.teardown();
  }, { scope: "worker" }],
});

test.describe.configure({ mode: "serial" });

let page: Page;
let context: BrowserContext;

test.beforeAll(async ({ browser, deployment }, testInfo) => {
  ({ page, context } = await setupBrowser(browser, testInfo));

  // Set base URL
  await page.goto(deployment.rhdhUrl);

  const loginHelper = new LoginHelper(page);
  await loginHelper.loginAsKeycloakUser();
});

test.afterAll(async () => {
  await context.close();
});

test("test 1", async () => {
  const uiHelper = new UIhelper(page);
  await uiHelper.verifyHeading(/Welcome/);
});

test("test 2", async () => {
  const uiHelper = new UIhelper(page);
  await uiHelper.openSidebar("Catalog");
});
```

## Best Practices

1. **Use `test.describe.configure({ mode: "serial" })`** - Required for serial mode
2. **Declare variables at describe level** - Shared across tests
3. **Login in beforeAll** - Once per suite
4. **Close context in afterAll** - Proper cleanup
5. **Use `setupBrowser`** - Enables video recording
6. **Order tests logically** - They run in order

## Related Pages

- [Testing Patterns Guide](/guide/core-concepts/testing-patterns.md) - Detailed serial vs parallel comparison
- [Error Handling](/guide/core-concepts/error-handling.md) - Handle failures gracefully
- [Basic Test Example](./basic-test.md) - Simple parallel test example
- [Catalog Operations](./catalog-operations.md) - Multi-step catalog workflows
