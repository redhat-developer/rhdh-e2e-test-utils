# CatalogImportPage API

Page object for the catalog import functionality.

## Import

```typescript
import { CatalogImportPage } from "rhdh-e2e-test-utils/pages";
```

## Constructor

```typescript
new CatalogImportPage(page: Page)
```

Creates a new CatalogImportPage instance with an internal `UIhelper`.

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | `Page` | Playwright Page object |

## Methods

### `registerExistingComponent(url, clickViewComponent?)`

```typescript
async registerExistingComponent(
  url: string,
  clickViewComponent?: boolean
): Promise<boolean>
```

Register an existing component from a URL. If the component is already registered, it will refresh instead of importing.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `url` | `string` | - | The component URL (e.g., GitHub catalog-info.yaml) |
| `clickViewComponent` | `boolean` | `true` | Whether to click "View Component" after import |

**Returns:** `boolean` - `true` if component was already registered, `false` if newly imported.

**Example:**
```typescript
const wasRegistered = await catalogImportPage.registerExistingComponent(
  "https://github.com/org/repo/blob/main/catalog-info.yaml"
);

if (wasRegistered) {
  console.log("Component was refreshed");
} else {
  console.log("Component was newly imported");
}
```

### `analyzeComponent(url)`

```typescript
async analyzeComponent(url: string): Promise<void>
```

Analyze a component URL without importing it. Fills the URL and clicks the "Analyze" button.

| Parameter | Type | Description |
|-----------|------|-------------|
| `url` | `string` | The component URL to analyze |

**Example:**
```typescript
await catalogImportPage.analyzeComponent(
  "https://github.com/org/repo/blob/main/catalog-info.yaml"
);
```

### `isComponentAlreadyRegistered()`

```typescript
async isComponentAlreadyRegistered(): Promise<boolean>
```

Check if the component is already registered. Returns `true` if the "Refresh" button is visible (indicating existing registration).

**Returns:** `boolean` - Whether the component is already registered.

**Example:**
```typescript
await catalogImportPage.analyzeComponent(url);
const isRegistered = await catalogImportPage.isComponentAlreadyRegistered();
```

### `inspectEntityAndVerifyYaml(text)`

```typescript
async inspectEntityAndVerifyYaml(text: string): Promise<void>
```

Open the entity inspector, switch to Raw YAML tab, and verify it contains the specified text.

| Parameter | Type | Description |
|-----------|------|-------------|
| `text` | `string` | Text to verify in the YAML |

**Example:**
```typescript
await catalogImportPage.inspectEntityAndVerifyYaml("kind: Component");
```

## Complete Example

```typescript
import { test, expect } from "@playwright/test";
import { CatalogImportPage } from "rhdh-e2e-test-utils/pages";
import { UIhelper } from "rhdh-e2e-test-utils/helpers";

test("import a new component", async ({ page }) => {
  const uiHelper = new UIhelper(page);
  const catalogImportPage = new CatalogImportPage(page);

  // Navigate to Create page
  await uiHelper.openSidebar("Create...");
  await uiHelper.clickButton("Register Existing Component");

  // Register the component
  const url = "https://github.com/myorg/myrepo/blob/main/catalog-info.yaml";
  const wasAlreadyRegistered = await catalogImportPage.registerExistingComponent(url);

  if (wasAlreadyRegistered) {
    console.log("Component was already registered, refreshed it");
  } else {
    // Verify we're on the component page
    await uiHelper.verifyHeading("my-component");
  }
});

test("analyze component without importing", async ({ page }) => {
  const catalogImportPage = new CatalogImportPage(page);

  await catalogImportPage.analyzeComponent(
    "https://github.com/myorg/myrepo/blob/main/catalog-info.yaml"
  );

  // Check the analyzed YAML
  await catalogImportPage.inspectEntityAndVerifyYaml("kind: Component");
});
```

## Related Pages

- [CatalogImportPage Guide](/guide/page-objects/catalog-import-page.md) - Detailed usage guide
- [Catalog Operations Example](/examples/catalog-operations.md) - More examples
