# CatalogPage

The `CatalogPage` class provides methods for interacting with the RHDH software catalog.

## Usage

```typescript
import { CatalogPage } from "rhdh-e2e-test-utils/pages";

const catalogPage = new CatalogPage(page);
```

## Methods

### `go()`

Navigate to the catalog page:

```typescript
await catalogPage.go();
```

### `search(text)`

Search for entities in the catalog:

```typescript
await catalogPage.search("my-component");
await catalogPage.search("service");
```

### `goToByName(name)`

Navigate to a specific component by name:

```typescript
await catalogPage.goToByName("my-component");
```

### `selectKind(kind)`

Filter by entity kind:

```typescript
await catalogPage.selectKind("Component");
await catalogPage.selectKind("API");
await catalogPage.selectKind("Template");
```

### `selectType(type)`

Filter by entity type:

```typescript
await catalogPage.selectType("service");
await catalogPage.selectType("website");
```

### `selectOwner(owner)`

Filter by owner:

```typescript
await catalogPage.selectOwner("team-a");
await catalogPage.selectOwner("user:default/john");
```

### `clearFilters()`

Clear all applied filters:

```typescript
await catalogPage.clearFilters();
```

## Complete Example

```typescript
import { test, expect } from "rhdh-e2e-test-utils/test";
import { CatalogPage } from "rhdh-e2e-test-utils/pages";

test("browse catalog", async ({ page, loginHelper, uiHelper }) => {
  await loginHelper.loginAsKeycloakUser();

  const catalogPage = new CatalogPage(page);

  // Navigate to catalog
  await catalogPage.go();

  // Filter by kind
  await catalogPage.selectKind("Component");

  // Search for component
  await catalogPage.search("my-service");

  // Verify results
  await uiHelper.verifyRowsInTable(["my-service"]);

  // Navigate to component
  await catalogPage.goToByName("my-service");

  // Verify component page
  await uiHelper.verifyHeading("my-service");
});
```
