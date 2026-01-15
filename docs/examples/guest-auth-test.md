# Guest Authentication

Example using guest authentication.

## .env

```bash
RHDH_VERSION="1.5"
INSTALLATION_METHOD="helm"
SKIP_KEYCLOAK_DEPLOYMENT=true
```

## Test File

```typescript
import { test, expect } from "rhdh-e2e-test-utils/test";

test.describe("Guest Authentication", () => {
  test.beforeAll(async ({ rhdh }) => {
    // Configure for guest auth
    await rhdh.configure({ auth: "guest" });
    await rhdh.deploy();
  });

  test.beforeEach(async ({ page, loginHelper }) => {
    await page.goto("/");
    await loginHelper.loginAsGuest();
  });

  test("should login as guest", async ({ uiHelper }) => {
    // Verify we're logged in
    await uiHelper.verifyHeading(/Welcome/);
  });

  test("should access catalog", async ({ page, uiHelper }) => {
    await uiHelper.openSidebar("Catalog");
    await expect(page).toHaveURL(/catalog/);
    await uiHelper.verifyHeading("Catalog");
  });

  test("should sign out", async ({ loginHelper, page }) => {
    await loginHelper.signOut();
    await expect(page.getByText("Enter")).toBeVisible();
  });
});
```

## When to Use

- Quick development testing
- Tests that don't require user identity
- Simplified CI pipelines
- Tests focused on UI behavior

## Notes

- No user roles or groups
- Session not persisted
- Fastest to set up
