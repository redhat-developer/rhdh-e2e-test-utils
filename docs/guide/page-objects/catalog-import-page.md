# CatalogImportPage

The `CatalogImportPage` class provides methods for registering components in the RHDH catalog.

## Usage

```typescript
import { CatalogImportPage } from "rhdh-e2e-test-utils/pages";

const catalogImportPage = new CatalogImportPage(page);
```

## Methods

### `registerExistingComponent(url)`

Register or refresh an existing component:

```typescript
const wasAlreadyRegistered = await catalogImportPage.registerExistingComponent(
  "https://github.com/org/repo/blob/main/catalog-info.yaml"
);

if (wasAlreadyRegistered) {
  console.log("Component was refreshed");
} else {
  console.log("Component was newly registered");
}
```

### `analyzeComponent(url)`

Analyze a component URL before registration:

```typescript
await catalogImportPage.analyzeComponent(
  "https://github.com/org/repo/blob/main/catalog-info.yaml"
);
```

### `inspectEntityAndVerifyYaml(expectedContent)`

Inspect the entity and verify YAML content:

```typescript
await catalogImportPage.inspectEntityAndVerifyYaml("kind: Component");
await catalogImportPage.inspectEntityAndVerifyYaml("name: my-component");
```

### `submitRegistration()`

Submit the component registration:

```typescript
await catalogImportPage.submitRegistration();
```

### `go()`

Navigate to the catalog import page:

```typescript
await catalogImportPage.go();
```

## Complete Example

```typescript
import { test, expect } from "rhdh-e2e-test-utils/test";
import { CatalogImportPage } from "rhdh-e2e-test-utils/pages";

test("register component", async ({ page, loginHelper, uiHelper }) => {
  await loginHelper.loginAsKeycloakUser();

  const catalogImportPage = new CatalogImportPage(page);

  // Navigate to import page
  await catalogImportPage.go();

  // Analyze component
  await catalogImportPage.analyzeComponent(
    "https://github.com/my-org/my-repo/blob/main/catalog-info.yaml"
  );

  // Verify YAML content
  await catalogImportPage.inspectEntityAndVerifyYaml("kind: Component");
  await catalogImportPage.inspectEntityAndVerifyYaml("name: my-component");

  // Register component
  await catalogImportPage.submitRegistration();

  // Verify registration success
  await uiHelper.verifyHeading("my-component");
});
```

### Registering Multiple Components

```typescript
test("register multiple components", async ({ page, loginHelper }) => {
  await loginHelper.loginAsKeycloakUser();

  const catalogImportPage = new CatalogImportPage(page);
  const componentUrls = [
    "https://github.com/org/repo1/blob/main/catalog-info.yaml",
    "https://github.com/org/repo2/blob/main/catalog-info.yaml",
    "https://github.com/org/repo3/blob/main/catalog-info.yaml",
  ];

  for (const url of componentUrls) {
    await catalogImportPage.registerExistingComponent(url);
  }
});
```
