# CatalogPage API

Page object for the RHDH software catalog (`/catalog` page).

## Import

```typescript
import { CatalogPage } from "rhdh-e2e-test-utils/pages";
```

## Constructor

```typescript
new CatalogPage(page: Page)
```

Creates a new CatalogPage instance with an internal `UIhelper`.

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | `Page` | Playwright Page object |

## Methods

### `go()`

```typescript
async go(): Promise<void>
```

Navigate to the catalog page via the sidebar.

**Example:**
```typescript
await catalogPage.go();
```

### `goToByName(name)`

```typescript
async goToByName(name: string): Promise<void>
```

Navigate to a specific component in the catalog by its name.

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | `string` | The entity name to navigate to |

**Example:**
```typescript
await catalogPage.goToByName("my-service");
```

### `goToBackstageJanusProject()`

```typescript
async goToBackstageJanusProject(): Promise<void>
```

Navigate to the `backstage-janus` project entity.

### `goToBackstageJanusProjectCITab()`

```typescript
async goToBackstageJanusProjectCITab(): Promise<void>
```

Navigate to the `backstage-janus` project and open its CI tab. Verifies the "Pipeline Runs" heading is visible.

### `search(text)`

```typescript
async search(text: string): Promise<void>
```

Search for entities in the catalog. Clears the existing search field, types the search text, and waits for the API response.

| Parameter | Type | Description |
|-----------|------|-------------|
| `text` | `string` | The search query |

**Example:**
```typescript
await catalogPage.search("my-component");
```

### `tableRow(content)`

```typescript
async tableRow(content: string): Promise<Locator>
```

Get a locator for a table row containing the specified content.

| Parameter | Type | Description |
|-----------|------|-------------|
| `content` | `string` | Text content to find in the row |

**Returns:** `Locator` - Playwright locator for the matching row.

**Example:**
```typescript
const row = await catalogPage.tableRow("my-service");
await row.click();
```

## Complete Example

```typescript
import { test, expect } from "@playwright/test";
import { CatalogPage } from "rhdh-e2e-test-utils/pages";

test("search and navigate catalog", async ({ page }) => {
  const catalogPage = new CatalogPage(page);

  // Navigate to catalog
  await catalogPage.go();

  // Search for a component
  await catalogPage.search("my-service");

  // Get and click the result row
  const row = await catalogPage.tableRow("my-service");
  await row.click();

  // Or navigate directly by name
  await catalogPage.goToByName("my-service");
});
```

## Related Pages

- [CatalogPage Guide](/guide/page-objects/catalog-page.md) - Detailed usage guide
- [UIhelper API](/api/helpers/ui-helper.md) - UI helper methods used internally
- [Catalog Operations Example](/examples/catalog-operations.md) - More examples
