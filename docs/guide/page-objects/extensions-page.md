# ExtensionsPage

The `ExtensionsPage` class provides methods for interacting with the RHDH extensions/plugins page.

## Usage

```typescript
import { ExtensionsPage } from "rhdh-e2e-test-utils/pages";

const extensionsPage = new ExtensionsPage(page);
```

## Methods

### `selectSupportTypeFilter(type)`

Filter plugins by support type:

```typescript
await extensionsPage.selectSupportTypeFilter("Red Hat");
await extensionsPage.selectSupportTypeFilter("Community");
```

### `verifyPluginDetails(details)`

Verify plugin details:

```typescript
await extensionsPage.verifyPluginDetails({
  pluginName: "Topology",
  badgeLabel: "Red Hat support",
  badgeText: "Red Hat",
});
```

### `waitForSearchResults(searchTerm)`

Search and wait for results:

```typescript
await extensionsPage.waitForSearchResults("catalog");
await extensionsPage.waitForSearchResults("kubernetes");
```

### `clickPlugin(pluginName)`

Click on a specific plugin:

```typescript
await extensionsPage.clickPlugin("Tech Radar");
```

### `go()`

Navigate to the extensions page:

```typescript
await extensionsPage.go();
```

## Complete Example

```typescript
import { test, expect } from "rhdh-e2e-test-utils/test";
import { ExtensionsPage } from "rhdh-e2e-test-utils/pages";

test("browse extensions", async ({ page, loginHelper, uiHelper }) => {
  await loginHelper.loginAsKeycloakUser();

  const extensionsPage = new ExtensionsPage(page);

  // Navigate to extensions
  await extensionsPage.go();

  // Filter by support type
  await extensionsPage.selectSupportTypeFilter("Red Hat");

  // Search for plugin
  await extensionsPage.waitForSearchResults("topology");

  // Verify plugin details
  await extensionsPage.verifyPluginDetails({
    pluginName: "Topology",
    badgeLabel: "Red Hat support",
    badgeText: "Red Hat",
  });

  // Click to view details
  await extensionsPage.clickPlugin("Topology");

  // Verify plugin page
  await uiHelper.verifyHeading("Topology");
});
```
