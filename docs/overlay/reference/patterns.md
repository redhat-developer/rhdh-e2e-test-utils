# Common Patterns

::: tip Overlay Documentation
This page covers writing tests within rhdh-plugin-export-overlays.
For using rhdh-e2e-test-utils in external projects, see the [Guide](/guide/).
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
import { $ } from "rhdh-e2e-test-utils/utils";
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
import { APIHelper } from "rhdh-e2e-test-utils/helpers";

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
