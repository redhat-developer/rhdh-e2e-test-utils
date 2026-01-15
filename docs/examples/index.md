# Examples

Copy-paste ready code examples for common scenarios.

## Available Examples

| Example | Description |
|---------|-------------|
| [Basic Test](/examples/basic-test) | Minimal working test |
| [Guest Authentication](/examples/guest-auth-test) | Simple guest login |
| [Keycloak Authentication](/examples/keycloak-auth-test) | OIDC authentication |
| [Catalog Operations](/examples/catalog-operations) | Catalog interactions |
| [API Operations](/examples/api-operations) | GitHub/Backstage APIs |
| [Custom Deployment](/examples/custom-deployment) | Custom configuration |
| [Serial Tests](/examples/serial-tests) | Shared browser session |

## Quick Reference

### Minimal Test

```typescript
import { test, expect } from "rhdh-e2e-test-utils/test";

test.beforeAll(async ({ rhdh }) => {
  await rhdh.deploy();
});

test("example", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Developer Hub/);
});
```

### With Login

```typescript
import { test, expect } from "rhdh-e2e-test-utils/test";

test.beforeAll(async ({ rhdh }) => {
  await rhdh.configure({ auth: "keycloak" });
  await rhdh.deploy();
});

test.beforeEach(async ({ loginHelper }) => {
  await loginHelper.loginAsKeycloakUser();
});

test("logged in test", async ({ uiHelper }) => {
  await uiHelper.verifyHeading("Welcome");
});
```

### With Page Object

```typescript
import { test } from "rhdh-e2e-test-utils/test";
import { CatalogPage } from "rhdh-e2e-test-utils/pages";

test("catalog test", async ({ page, loginHelper }) => {
  await loginHelper.loginAsKeycloakUser();

  const catalogPage = new CatalogPage(page);
  await catalogPage.go();
  await catalogPage.search("my-component");
});
```
