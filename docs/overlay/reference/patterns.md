# Common Patterns

::: tip Overlay Documentation
This page covers writing tests within rhdh-plugin-export-overlays.
For using @red-hat-developer-hub/e2e-test-utils in external projects, see the [Guide](/guide/).
:::

This page documents common testing patterns used in overlay E2E tests.

## Setup Patterns

### Basic Keycloak Setup

```typescript
test.describe("Plugin tests", () => {
  test.beforeAll(async ({ rhdh }) => {
    await rhdh.configure({ auth: "keycloak" });
    await rhdh.deploy();
  });

  test.beforeEach(async ({ loginHelper }) => {
    await loginHelper.loginAsKeycloakUser();
  });
});
```

### Fetching a Token to Use with RbacApiHelper

A common pattern is to retrieve a Backstage identity token after login and pass it to `RbacApiHelper` (or another API helper) to make authenticated API calls:

```typescript
import { test } from '@red-hat-developer-hub/e2e-test-utils/test';
import {
  AuthApiHelper,
  RbacApiHelper,
} from '@red-hat-developer-hub/e2e-test-utils/helpers';

test.describe('RBAC policy management', () => {
  let rbacApiHelper: RbacApiHelper;

  test.beforeAll(async ({ page, loginHelper }) => {
    // Log in first so the page session is authenticated
    await page.goto('/');
    await loginHelper.loginAsKeycloakUser();

    // Retrieve the Backstage identity token
    const authApiHelper = new AuthApiHelper(page);
    const token = await authApiHelper.getToken();

    // Build the RBAC helper with the token
    rbacApiHelper = await RbacApiHelper.build(token);
  });

  test('verify role policies exist', async () => {
    const response = await rbacApiHelper.getPoliciesByRole('my-role');
    // assert on response...
  });
});
```

## Project and Spec Best Practices

Each Playwright project name creates a **separate namespace**. To keep deployments fast and predictable:

- Use **one project** named after the workspace.
- Keep **one spec file** per workspace unless your requirements differ.

If you need different auth/configs or separate namespaces, use multiple projects or manage deployments directly with `RHDHDeployment`.

### Guest Authentication Setup

```typescript
test.describe("Plugin tests", () => {
  test.beforeAll(async ({ rhdh }) => {
    await rhdh.configure({ auth: "guest" });
    await rhdh.deploy();
  });

  test.beforeEach(async ({ loginHelper }) => {
    await loginHelper.loginAsGuest();
  });
});
```

### Setup with External Service

```typescript
import { $ } from "@red-hat-developer-hub/e2e-test-utils/utils";
import path from "path";

const setupScript = path.join(import.meta.dirname, "deploy-service.sh");

test.describe("Plugin tests", () => {
  test.beforeAll(async ({ rhdh }) => {
    const project = rhdh.deploymentConfig.namespace;

    await rhdh.configure({ auth: "keycloak" });
    await $`bash ${setupScript} ${project}`;

    process.env.SERVICE_URL = await rhdh.k8sClient.getRouteLocation(
      project,
      "service-name",
    );

    await rhdh.deploy();
  });
});
```

## Navigation Patterns

### Sidebar Navigation

```typescript
test("Navigate via sidebar", async ({ uiHelper }) => {
  await uiHelper.openSidebar("Plugin Name");
  await uiHelper.verifyHeading("Expected Heading");
});
```

### Tab Navigation

```typescript
test("Navigate tabs", async ({ uiHelper }) => {
  await uiHelper.openSidebar("Plugin Name");
  await uiHelper.clickTab("Details");
  await uiHelper.verifyText("Details content");
});
```

### Direct URL Navigation

```typescript
test("Navigate by URL", async ({ page, uiHelper }) => {
  await page.goto("/catalog");
  await uiHelper.verifyHeading("Catalog");
});
```

## Verification Patterns

### Verify Heading

```typescript
await uiHelper.verifyHeading("Expected Heading");
```

### Verify Text

```typescript
await uiHelper.verifyText("Expected text");
```

### Verify Element Visibility

```typescript
await expect(page.locator('text="Expected"')).toBeVisible();
```

### Verify Element Hidden

```typescript
await expect(page.locator('text="Hidden"')).not.toBeVisible();
```

### Verify Multiple Items

```typescript
async function verifyItems(page: Page, items: string[]) {
  for (const item of items) {
    await expect(page.locator(`text="${item}"`)).toBeVisible();
  }
}
```

## Interaction Patterns

### Click Button

```typescript
await uiHelper.clickButton("Submit");
```

### Click Link

```typescript
await uiHelper.clickLink("Learn More");
```

### Fill Input

```typescript
await uiHelper.fillTextInputByLabel("Username", "testuser");
```

### Search

```typescript
await uiHelper.searchInputPlaceholder("Search...", "query");
```

### Select Dropdown

```typescript
await uiHelper.selectMuiBox("Category", "Option 1");
```

### Dismiss quickstart drawer

When the RHDH quickstart plugin shows its drawer, it can cover catalog search and other controls. Call this after login or navigation if needed (it is a no-op when **Hide** is not visible):

```typescript
await uiHelper.dismissQuickstartIfVisible();
```

See [UIhelper](/guide/helpers/ui-helper) and [UIhelper API](/api/helpers/ui-helper).

## Table Patterns

### Verify Table Rows

```typescript
await uiHelper.verifyRowsInTable(["Row 1", "Row 2", "Row 3"]);
```

### Click Row Action

```typescript
await uiHelper.clickOnButtonInTableByUniqueText("Row 1", "Edit");
```

### Verify Row Content

```typescript
await uiHelper.verifyRowInTableByUniqueText("Row 1", ["Column 1", "Column 2"]);
```

## Waiting Patterns

### Wait for Load

```typescript
await uiHelper.waitForLoad();
```

### Wait for Text

```typescript
await expect(page.locator('text="Loading..."')).not.toBeVisible();
```

### Wait for Element

```typescript
await page.locator('text="Content"').waitFor({ state: "visible" });
```

### Custom Wait

```typescript
await page.waitForSelector('[data-testid="loaded"]');
```

## Long-Running Setup and Deployments (Timeouts)

If `beforeAll` performs slow setup (deployment, external services), increase the timeout explicitly.

### Which Timeout Are You Increasing?

- `test.setTimeout(...)` inside `beforeAll` increases the **timeout for that hook**.
- `test.setTimeout(...)` inside a test increases the **timeout for that test**.
- The Playwright config `timeout` is the **default per-test timeout**.

### Increase `beforeAll` Timeout

```typescript
test.beforeAll(async ({ rhdh }) => {
  test.setTimeout(10 * 60 * 1000); // 10 minutes
  await rhdh.configure({ auth: "keycloak" });
  await rhdh.deploy();
});
```

### Extend RHDH Readiness Wait

```typescript
test.beforeAll(async ({ rhdh }) => {
  test.setTimeout(10 * 60 * 1000);
  await rhdh.configure({ auth: "keycloak" });
  await rhdh.deploy();
  await rhdh.waitUntilReady(600); // seconds
});
```

Note: `rhdh.deploy()` already increases the test timeout (600s / 10 minutes). If your setup does more work before deploy, set a higher timeout in `beforeAll`.

## Error Handling Patterns

### Expect Error Message

```typescript
test("Handle error", async ({ uiHelper }) => {
  await uiHelper.clickButton("Invalid Action");
  await uiHelper.verifyAlertErrorMessage("Error occurred");
});
```

### Try-Catch Pattern

```typescript
test("Graceful failure", async ({ page }) => {
  try {
    await page.locator('text="Rare Element"').click({ timeout: 5000 });
  } catch {
    console.log("Element not present, continuing...");
  }
});
```

## Helper Function Patterns

### Reusable Verification

```typescript
async function verifySection(page: Page, section: string, content: string) {
  const locator = page
    .locator(`h2:has-text("${section}")`)
    .locator("xpath=ancestor::*")
    .locator(`text=${content}`);
  await locator.scrollIntoViewIfNeeded();
  await expect(locator).toBeVisible();
}

test("Verify sections", async ({ page }) => {
  await verifySection(page, "Languages", "JavaScript");
  await verifySection(page, "Frameworks", "React");
});
```

### Data-Driven Tests

```typescript
const testCases = [
  { name: "Case 1", input: "a", expected: "A" },
  { name: "Case 2", input: "b", expected: "B" },
];

for (const tc of testCases) {
  test(`Test ${tc.name}`, async ({ page }) => {
    await page.fill('input', tc.input);
    await expect(page.locator('.result')).toHaveText(tc.expected);
  });
}
```

## Serial Test Pattern

For tests that must run in order:

```typescript
test.describe.configure({ mode: "serial" });

test.describe("Serial tests", () => {
  test("Step 1: Create", async () => {
    // Create resource
  });

  test("Step 2: Verify", async () => {
    // Verify resource exists
  });

  test("Step 3: Delete", async () => {
    // Delete resource
  });
});
```

## Screenshot Pattern

```typescript
test("Take screenshot", async ({ page }) => {
  await page.goto("/dashboard");
  await page.screenshot({ path: "dashboard.png", fullPage: true });
});
```

## Page Objects

The package provides pre-built page objects for common RHDH pages (`CatalogPage`, `HomePage`, `CatalogImportPage`, `ExtensionsPage`, `NotificationPage`).

See [Page Objects Guide](/guide/page-objects/) for usage and available methods.

## API Helper

For programmatic catalog or GitHub API operations, use `APIHelper`:

```typescript
import { APIHelper } from "@red-hat-developer-hub/e2e-test-utils/helpers";

test("verify catalog", async ({ rhdh }) => {
  const apiHelper = new APIHelper();
  await apiHelper.setBaseUrl(rhdh.rhdhUrl);

  const users = await apiHelper.getAllCatalogUsersFromAPI();
  expect(users.length).toBeGreaterThan(0);
});
```

See [APIHelper Guide](/guide/helpers/api-helper) for GitHub and catalog API operations.

## Related Pages

- [Spec Files](/overlay/test-structure/spec-files) - Writing tests
- [UIhelper API](/api/helpers/ui-helper) - Full API reference
- [Page Objects](/guide/page-objects/) - Pre-built page abstractions
- [APIHelper](/guide/helpers/api-helper) - Catalog and GitHub API
- [Troubleshooting](./troubleshooting) - Common issues
