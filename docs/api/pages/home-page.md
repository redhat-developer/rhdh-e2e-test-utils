# HomePage API

Page object for the RHDH home page.

## Import

```typescript
import { HomePage } from "rhdh-e2e-test-utils/pages";
```

## Constructor

```typescript
new HomePage(page: Page)
```

Creates a new HomePage instance with an internal `UIhelper`.

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | `Page` | Playwright Page object |

## Methods

### `verifyQuickSearchBar(text)`

```typescript
async verifyQuickSearchBar(text: string): Promise<void>
```

Verify the quick search bar functionality by entering text and verifying a matching link appears.

| Parameter | Type | Description |
|-----------|------|-------------|
| `text` | `string` | Text to search for |

**Example:**
```typescript
await homePage.verifyQuickSearchBar("my-component");
```

### `verifyQuickAccess(section, quickAccessItem, expand?)`

```typescript
async verifyQuickAccess(
  section: string,
  quickAccessItem: string,
  expand?: boolean
): Promise<void>
```

Verify a quick access item is visible in a specific section.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `section` | `string` | - | The accordion section name |
| `quickAccessItem` | `string` | - | The item to verify |
| `expand` | `boolean` | `false` | Whether to expand the section first |

**Example:**
```typescript
// Verify item in already-expanded section
await homePage.verifyQuickAccess("Favorites", "My Component");

// Expand section first, then verify
await homePage.verifyQuickAccess("Recent", "backstage-janus", true);
```

### `verifyVisitedCardContent(section)`

```typescript
async verifyVisitedCardContent(section: string): Promise<void>
```

Verify that a visited card section exists and may contain items.

| Parameter | Type | Description |
|-----------|------|-------------|
| `section` | `string` | The card section name |

**Example:**
```typescript
await homePage.verifyVisitedCardContent("Recently Visited");
```

## Complete Example

```typescript
import { test, expect } from "@playwright/test";
import { HomePage } from "rhdh-e2e-test-utils/pages";

test("verify home page features", async ({ page }) => {
  const homePage = new HomePage(page);

  // Verify quick search works
  await homePage.verifyQuickSearchBar("my-service");

  // Verify quick access sections
  await homePage.verifyQuickAccess("Favorites", "My App");
  await homePage.verifyQuickAccess("Documentation", "Getting Started", true);

  // Verify visited content
  await homePage.verifyVisitedCardContent("Recently Visited");
});
```

## Related Pages

- [HomePage Guide](/guide/page-objects/home-page.md) - Detailed usage guide
- [UIhelper API](/api/helpers/ui-helper.md) - UI helper methods used internally
