# ExtensionsPage API

Page object for the RHDH extensions/plugins marketplace page.

## Import

```typescript
import { ExtensionsPage } from "rhdh-e2e-test-utils/pages";
```

## Constructor

```typescript
new ExtensionsPage(page: Page)
```

Creates a new ExtensionsPage instance with an internal `UIhelper`.

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | `Page` | Playwright Page object |

## Properties

| Property | Type | Description |
|----------|------|-------------|
| `badge` | `Locator` | Locator for the TaskAltIcon badge |

## Methods

### `clickReadMoreByPluginTitle(pluginTitle)`

```typescript
async clickReadMoreByPluginTitle(pluginTitle: string): Promise<void>
```

Click the "Read more" link for a specific plugin.

| Parameter | Type | Description |
|-----------|------|-------------|
| `pluginTitle` | `string` | The plugin title to find |

**Example:**
```typescript
await extensionsPage.clickReadMoreByPluginTitle("Tech Radar");
```

### `selectSupportTypeFilter(supportType)`

```typescript
async selectSupportTypeFilter(supportType: string): Promise<void>
```

Filter plugins by support type.

| Parameter | Type | Description |
|-----------|------|-------------|
| `supportType` | `string` | The support type to filter by |

**Example:**
```typescript
await extensionsPage.selectSupportTypeFilter("Red Hat");
```

### `resetSupportTypeFilter(supportType)`

```typescript
async resetSupportTypeFilter(supportType: string): Promise<void>
```

Reset/toggle off a support type filter.

| Parameter | Type | Description |
|-----------|------|-------------|
| `supportType` | `string` | The support type to toggle off |

### `waitForSearchResults(searchText)`

```typescript
async waitForSearchResults(searchText: string): Promise<void>
```

Wait for search results to contain the specified text.

| Parameter | Type | Description |
|-----------|------|-------------|
| `searchText` | `string` | Text to wait for in results |

### `verifyMultipleHeadings(headings?)`

```typescript
async verifyMultipleHeadings(headings?: string[]): Promise<void>
```

Verify multiple headings are visible on the page.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `headings` | `string[]` | Common headings | List of headings to verify |

**Default headings:** `["Versions", "Author", "Tags", "Category", "Publisher", "Support Provider"]`

### `verifyPluginDetails(options)`

```typescript
async verifyPluginDetails(options: {
  pluginName: string;
  badgeLabel: string;
  badgeText: string;
  headings?: string[];
  includeTable?: boolean;
  includeAbout?: boolean;
}): Promise<void>
```

Click on a plugin and verify its details modal.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `pluginName` | `string` | - | Plugin name to click |
| `badgeLabel` | `string` | - | Expected badge label |
| `badgeText` | `string` | - | Expected badge text |
| `headings` | `string[]` | Common headings | Headings to verify |
| `includeTable` | `boolean` | `true` | Verify table headers |
| `includeAbout` | `boolean` | `false` | Verify "About" text |

**Example:**
```typescript
await extensionsPage.verifyPluginDetails({
  pluginName: "Tech Radar",
  badgeLabel: "support-type",
  badgeText: "Red Hat",
  includeAbout: true,
});
```

### `verifySupportTypeBadge(options)`

```typescript
async verifySupportTypeBadge(options: {
  supportType: string;
  pluginName?: string;
  badgeLabel: string;
  badgeText: string;
  tooltipText: string;
  searchTerm?: string;
  headings?: string[];
  includeTable?: boolean;
  includeAbout?: boolean;
}): Promise<void>
```

Filter by support type and verify badge details, optionally opening a specific plugin.

| Option | Type | Description |
|--------|------|-------------|
| `supportType` | `string` | Support type to filter by |
| `pluginName` | `string` | Optional plugin to verify |
| `badgeLabel` | `string` | Expected badge label |
| `badgeText` | `string` | Expected badge text |
| `tooltipText` | `string` | Expected tooltip text on hover |
| `searchTerm` | `string` | Optional search term |
| `headings` | `string[]` | Headings to verify |
| `includeTable` | `boolean` | Verify table headers |
| `includeAbout` | `boolean` | Verify "About" text |

### `verifyKeyValueRowElements(rowTitle, rowValue)`

```typescript
async verifyKeyValueRowElements(rowTitle: string, rowValue: string): Promise<void>
```

Verify a key-value row in a table.

| Parameter | Type | Description |
|-----------|------|-------------|
| `rowTitle` | `string` | The row title/key |
| `rowValue` | `string` | The expected value |

## Complete Example

```typescript
import { test, expect } from "@playwright/test";
import { ExtensionsPage } from "rhdh-e2e-test-utils/pages";
import { UIhelper } from "rhdh-e2e-test-utils/helpers";

test("browse and filter extensions", async ({ page }) => {
  const uiHelper = new UIhelper(page);
  const extensionsPage = new ExtensionsPage(page);

  // Navigate to extensions
  await uiHelper.openSidebar("Extensions");

  // Filter by support type
  await extensionsPage.selectSupportTypeFilter("Red Hat");

  // Verify a specific plugin
  await extensionsPage.verifyPluginDetails({
    pluginName: "Tech Radar",
    badgeLabel: "support-type",
    badgeText: "Red Hat",
    includeAbout: true,
  });

  // Reset filter
  await extensionsPage.resetSupportTypeFilter("Red Hat");
});
```

## Related Pages

- [ExtensionsPage Guide](/guide/page-objects/extensions-page.md) - Detailed usage guide
