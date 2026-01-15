# HomePage

The `HomePage` class provides methods for interacting with the RHDH home page.

## Usage

```typescript
import { HomePage } from "rhdh-e2e-test-utils/pages";

const homePage = new HomePage(page);
```

## Methods

### `verifyQuickSearchBar(searchText)`

Search using the quick search bar and verify results:

```typescript
await homePage.verifyQuickSearchBar("my-component");
```

### `verifyQuickAccess(section, item)`

Verify an item exists in a quick access section:

```typescript
await homePage.verifyQuickAccess("Favorites", "my-component");
await homePage.verifyQuickAccess("Recently Visited", "my-api");
```

### `clickQuickAccessItem(section, item)`

Click an item in a quick access section:

```typescript
await homePage.clickQuickAccessItem("Favorites", "my-component");
```

## Complete Example

```typescript
import { test, expect } from "rhdh-e2e-test-utils/test";
import { HomePage } from "rhdh-e2e-test-utils/pages";

test("home page interactions", async ({ page, loginHelper }) => {
  await loginHelper.loginAsKeycloakUser();

  const homePage = new HomePage(page);

  // Use quick search
  await homePage.verifyQuickSearchBar("my-component");

  // Verify quick access sections
  await homePage.verifyQuickAccess("Favorites", "my-component");

  // Click quick access item
  await homePage.clickQuickAccessItem("Favorites", "my-component");
});
```
