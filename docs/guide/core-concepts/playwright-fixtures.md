# Playwright Fixtures

The package extends Playwright's test framework with custom fixtures designed for RHDH testing.

## Importing Fixtures

```typescript
import { test, expect } from "rhdh-e2e-test-utils/test";
```

This import replaces the standard Playwright import and provides additional fixtures.

## Available Fixtures

| Fixture | Scope | Type | Description |
|---------|-------|------|-------------|
| `rhdh` | worker | `RHDHDeployment` | Shared RHDH deployment across all tests in a worker |
| `uiHelper` | test | `UIhelper` | UI interaction helper for Material-UI components |
| `loginHelper` | test | `LoginHelper` | Authentication helper for various providers |
| `baseURL` | test | `string` | Automatically set to the RHDH instance URL |

## Fixture Scopes

### Worker-Scoped Fixtures

The `rhdh` fixture is worker-scoped, meaning:

- One deployment is shared across all tests in a worker
- Deployment happens once per worker, not per test
- All tests in the same worker share the same RHDH instance

```typescript
test.beforeAll(async ({ rhdh }) => {
  // This runs once per worker
  await rhdh.configure({ auth: "keycloak" });
  await rhdh.deploy();
});
```

### Test-Scoped Fixtures

The `uiHelper`, `loginHelper`, and `baseURL` fixtures are test-scoped:

- Created fresh for each test
- Tied to the test's page instance

```typescript
test("example", async ({ uiHelper, loginHelper }) => {
  // Fresh instances for this test
  await loginHelper.loginAsKeycloakUser();
  await uiHelper.verifyHeading("Welcome");
});
```

## Fixture Details

### `rhdh` Fixture

The `rhdh` fixture provides access to the `RHDHDeployment` instance:

```typescript
test.beforeAll(async ({ rhdh }) => {
  // Configure deployment options
  await rhdh.configure({
    auth: "keycloak",
    appConfig: "tests/config/app-config.yaml",
  });

  // Deploy RHDH
  await rhdh.deploy();
});

test("access deployment info", async ({ rhdh }) => {
  console.log(`URL: ${rhdh.rhdhUrl}`);
  console.log(`Namespace: ${rhdh.deploymentConfig.namespace}`);

  // Access Kubernetes client
  const route = await rhdh.k8sClient.getRouteLocation(
    rhdh.deploymentConfig.namespace,
    "my-route"
  );
});
```

### `uiHelper` Fixture

The `uiHelper` fixture provides UI interaction methods:

```typescript
test("UI interactions", async ({ uiHelper }) => {
  // Wait for page to load
  await uiHelper.waitForLoad();

  // Verify content
  await uiHelper.verifyHeading("Welcome");
  await uiHelper.verifyText("Some content");

  // Navigate
  await uiHelper.openSidebar("Catalog");
  await uiHelper.clickTab("Overview");

  // Interact with forms
  await uiHelper.fillTextInputByLabel("Name", "my-component");
  await uiHelper.clickButton("Submit");
});
```

### `loginHelper` Fixture

The `loginHelper` fixture handles authentication:

```typescript
test.beforeEach(async ({ loginHelper }) => {
  // Guest authentication
  await loginHelper.loginAsGuest();

  // Or Keycloak authentication
  await loginHelper.loginAsKeycloakUser();

  // Or with specific credentials
  await loginHelper.loginAsKeycloakUser("test1", "test1@123");
});

test.afterEach(async ({ loginHelper }) => {
  await loginHelper.signOut();
});
```

### `baseURL` Fixture

The `baseURL` fixture is automatically set to the RHDH URL:

```typescript
test("using baseURL", async ({ page, baseURL }) => {
  // page.goto("/") automatically uses baseURL
  await page.goto("/");

  // Equivalent to:
  await page.goto(baseURL);
});
```

## Namespace Derivation

The namespace for each worker is derived from the Playwright project name:

```typescript
// playwright.config.ts
export default defineConfig({
  projects: [
    { name: "tech-radar" },  // Namespace: tech-radar
    { name: "catalog" },     // Namespace: catalog
  ],
});
```

## Auto-Cleanup

In CI environments (when `CI` environment variable is set):

- Namespaces are automatically deleted after tests complete
- Prevents resource accumulation on shared clusters

For local development:
- Namespaces are preserved for debugging
- Manual cleanup may be required

## Example: Complete Test Setup

```typescript
import { test, expect } from "rhdh-e2e-test-utils/test";

test.describe("My Plugin Tests", () => {
  test.beforeAll(async ({ rhdh }) => {
    await rhdh.configure({
      auth: "keycloak",
      appConfig: "tests/config/app-config.yaml",
      dynamicPlugins: "tests/config/plugins.yaml",
    });
    await rhdh.deploy();
  });

  test.beforeEach(async ({ page, loginHelper }) => {
    await page.goto("/");
    await loginHelper.loginAsKeycloakUser();
  });

  test("should display heading", async ({ uiHelper }) => {
    await uiHelper.openSidebar("My Plugin");
    await uiHelper.verifyHeading("My Plugin");
  });

  test("should show data", async ({ uiHelper }) => {
    await uiHelper.openSidebar("My Plugin");
    await uiHelper.verifyRowsInTable(["Item 1", "Item 2"]);
  });
});
```
