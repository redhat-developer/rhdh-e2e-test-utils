# UIhelper

The `UIhelper` class provides methods for interacting with Material-UI components in RHDH.

## Getting UIhelper

```typescript
// Via fixture (recommended)
import { test } from "rhdh-e2e-test-utils/test";

test("example", async ({ uiHelper }) => {
  await uiHelper.verifyHeading("Welcome");
});

// Direct instantiation
import { UIhelper } from "rhdh-e2e-test-utils/helpers";

const uiHelper = new UIhelper(page);
```

## Wait Operations

### `waitForLoad(timeout?)`

Wait for the page to fully load:

```typescript
await uiHelper.waitForLoad();
await uiHelper.waitForLoad(10000); // Custom timeout
```

## Verification Methods

### `verifyHeading(heading, timeout?)`

Verify a heading is visible:

```typescript
await uiHelper.verifyHeading("Welcome to RHDH");
await uiHelper.verifyHeading(/Welcome/); // Regex
```

### `verifyText(text, timeout?)`

Verify text is visible on the page:

```typescript
await uiHelper.verifyText("Some content");
await uiHelper.verifyText(/pattern/); // Regex
```

### `verifyLink(link)`

Verify a link is visible:

```typescript
await uiHelper.verifyLink("View Details");
await uiHelper.verifyLink(/details/i);
```

## Button Interactions

### `clickButton(label, options?)`

Click a button by its label:

```typescript
await uiHelper.clickButton("Submit");
await uiHelper.clickButton("Cancel", { exact: true });
await uiHelper.clickButton("Save", { force: true });
```

### `clickButtonByLabel(label, options?)`

Click a button using aria-label:

```typescript
await uiHelper.clickButtonByLabel("Close");
await uiHelper.clickButtonByLabel("Settings", { force: true });
```

### `clickButtonByText(text)`

Click a button by visible text:

```typescript
await uiHelper.clickButtonByText("Get Started");
```

## Navigation

### `openSidebar(navBarText)`

Open a sidebar navigation item:

```typescript
await uiHelper.openSidebar("Catalog");
await uiHelper.openSidebar("Tech Radar");
await uiHelper.openSidebar("Home");
```

Supported sidebar items:
- `"Home"`
- `"Catalog"`
- `"APIs"`
- `"Docs"`
- `"Learning Paths"`
- `"Tech Radar"`
- `"Create..."`
- `"Settings"`

### `openCatalogSidebar(navBarText)`

Open a catalog-specific sidebar item:

```typescript
await uiHelper.openCatalogSidebar("Overview");
await uiHelper.openCatalogSidebar("Dependencies");
```

### `clickTab(tabName)`

Click a tab:

```typescript
await uiHelper.clickTab("Overview");
await uiHelper.clickTab("Dependencies");
await uiHelper.clickTab("API");
```

## Table Operations

### `verifyRowsInTable(rowTexts, exact?)`

Verify rows exist in a table:

```typescript
await uiHelper.verifyRowsInTable(["my-component", "my-api"]);
await uiHelper.verifyRowsInTable([/component-\d+/]); // Regex
await uiHelper.verifyRowsInTable(["exact-match"], true);
```

### `verifyCellsInTable(cellTexts)`

Verify cells exist in a table:

```typescript
await uiHelper.verifyCellsInTable(["cell-value-1", "cell-value-2"]);
```

### `verifyRowInTableByUniqueText(uniqueRowText, cellTexts)`

Verify specific cells in a row identified by unique text:

```typescript
await uiHelper.verifyRowInTableByUniqueText(
  "my-component",
  ["Component", "Production", "Running"]
);
```

### `verifyRowNotInTable(rowText)`

Verify a row does NOT exist:

```typescript
await uiHelper.verifyRowNotInTable("deleted-component");
```

## Form Interactions

### `fillTextInputByLabel(label, value)`

Fill a text input by its label:

```typescript
await uiHelper.fillTextInputByLabel("Name", "my-component");
await uiHelper.fillTextInputByLabel("Description", "A test component");
```

### `selectMuiBox(label, value)`

Select a value in a Material-UI select box:

```typescript
await uiHelper.selectMuiBox("Kind", "Component");
await uiHelper.selectMuiBox("Type", "Service");
```

### `checkCheckbox(label)`

Check a checkbox:

```typescript
await uiHelper.checkCheckbox("I agree to the terms");
await uiHelper.checkCheckbox("Enable notifications");
```

### `clearTextInputByLabel(label)`

Clear a text input:

```typescript
await uiHelper.clearTextInputByLabel("Search");
```

## Card Interactions

### `verifyTextinCard(cardTitle, text)`

Verify text exists in a specific card:

```typescript
await uiHelper.verifyTextinCard("About", "This is a component");
```

### `verifyLinkinCard(cardTitle, linkText)`

Verify a link exists in a card:

```typescript
await uiHelper.verifyLinkinCard("Links", "View Source");
```

### `clickBtnInCard(cardTitle, buttonLabel)`

Click a button in a specific card:

```typescript
await uiHelper.clickBtnInCard("Actions", "Refresh");
```

## Search Operations

### `searchInputPlaceholder(placeholder, searchText)`

Search using an input with specific placeholder:

```typescript
await uiHelper.searchInputPlaceholder("Filter", "my-component");
```

## Alert and Dialog

### `verifyAlertContains(text)`

Verify an alert contains specific text:

```typescript
await uiHelper.verifyAlertContains("Success");
await uiHelper.verifyAlertContains("Error occurred");
```

### `closeDialog()`

Close an open dialog:

```typescript
await uiHelper.closeDialog();
```

## Complete Example

```typescript
import { test, expect } from "rhdh-e2e-test-utils/test";

test("interact with catalog", async ({ page, uiHelper, loginHelper }) => {
  // Login
  await loginHelper.loginAsKeycloakUser();

  // Navigate
  await uiHelper.openSidebar("Catalog");
  await uiHelper.verifyHeading("Catalog");

  // Search
  await uiHelper.searchInputPlaceholder("Filter", "my-component");

  // Verify results
  await uiHelper.verifyRowsInTable(["my-component"]);

  // Click on component
  await page.click("text=my-component");

  // Verify component page
  await uiHelper.verifyHeading("my-component");
  await uiHelper.clickTab("Overview");
  await uiHelper.verifyTextinCard("About", "Description");

  // Interact with actions
  await uiHelper.clickBtnInCard("Actions", "Unregister");
  await uiHelper.clickButton("Cancel");
});
```

## Related Pages

- [UIhelper API Reference](/api/helpers/ui-helper.md) - Complete method signatures
- [LoginHelper](./login-helper.md) - Authentication helpers
- [APIHelper](./api-helper.md) - Backend API helpers
- [Page Objects](/guide/page-objects/) - Higher-level page abstractions
- [Testing Patterns](/guide/core-concepts/testing-patterns.md) - Serial vs parallel testing
