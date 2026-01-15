# Catalog Operations

Examples of catalog interactions.

## Browse Catalog

```typescript
import { test, expect } from "rhdh-e2e-test-utils/test";
import { CatalogPage } from "rhdh-e2e-test-utils/pages";

test.describe("Catalog Operations", () => {
  test.beforeAll(async ({ rhdh }) => {
    await rhdh.configure({ auth: "keycloak" });
    await rhdh.deploy();
  });

  test.beforeEach(async ({ loginHelper }) => {
    await loginHelper.loginAsKeycloakUser();
  });

  test("browse catalog", async ({ page, uiHelper }) => {
    const catalogPage = new CatalogPage(page);

    // Navigate to catalog
    await catalogPage.go();

    // Verify page loaded
    await uiHelper.verifyHeading("Catalog");

    // Filter by kind
    await catalogPage.selectKind("Component");

    // Search
    await catalogPage.search("example");

    // Verify results
    await uiHelper.verifyRowsInTable(["example-component"]);
  });

  test("view component details", async ({ page, uiHelper }) => {
    const catalogPage = new CatalogPage(page);

    await catalogPage.go();
    await catalogPage.goToByName("example-component");

    // Verify component page
    await uiHelper.verifyHeading("example-component");
    await uiHelper.clickTab("Overview");
    await uiHelper.verifyTextinCard("About", "description");
  });
});
```

## Register Component

```typescript
import { test, expect } from "rhdh-e2e-test-utils/test";
import { CatalogImportPage } from "rhdh-e2e-test-utils/pages";

test("register component", async ({ page, loginHelper, uiHelper }) => {
  await loginHelper.loginAsKeycloakUser();

  const importPage = new CatalogImportPage(page);

  await importPage.go();

  // Analyze component
  await importPage.analyzeComponent(
    "https://github.com/my-org/my-repo/blob/main/catalog-info.yaml"
  );

  // Verify YAML
  await importPage.inspectEntityAndVerifyYaml("kind: Component");

  // Register
  await importPage.submitRegistration();

  // Verify success
  await uiHelper.verifyHeading("my-component");
});
```

## Table Verification

```typescript
import { test } from "rhdh-e2e-test-utils/test";
import { CatalogPage } from "rhdh-e2e-test-utils/pages";

test("verify catalog table", async ({ page, loginHelper, uiHelper }) => {
  await loginHelper.loginAsKeycloakUser();

  const catalogPage = new CatalogPage(page);
  await catalogPage.go();

  // Verify multiple rows exist
  await uiHelper.verifyRowsInTable([
    "component-1",
    "component-2",
    "component-3",
  ]);

  // Verify cells in specific row
  await uiHelper.verifyRowInTableByUniqueText(
    "component-1",
    ["Component", "Production", "team-a"]
  );

  // Verify row doesn't exist
  await uiHelper.verifyRowNotInTable("deleted-component");
});
```

## Navigation

```typescript
import { test, expect } from "rhdh-e2e-test-utils/test";

test("catalog navigation", async ({ page, loginHelper, uiHelper }) => {
  await loginHelper.loginAsKeycloakUser();

  // Navigate via sidebar
  await uiHelper.openSidebar("Catalog");
  await expect(page).toHaveURL(/catalog/);

  // Click on entity
  await page.click("text=example-component");

  // Navigate tabs
  await uiHelper.clickTab("Dependencies");
  await uiHelper.clickTab("API");
  await uiHelper.clickTab("Overview");

  // Use catalog sidebar
  await uiHelper.openCatalogSidebar("Dependencies");
});
```
