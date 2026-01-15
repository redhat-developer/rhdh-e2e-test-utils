# Keycloak Authentication

Example using Keycloak OIDC authentication.

## .env

```bash
RHDH_VERSION="1.5"
INSTALLATION_METHOD="helm"
SKIP_KEYCLOAK_DEPLOYMENT=false
```

## Basic Keycloak Test

```typescript
import { test, expect } from "rhdh-e2e-test-utils/test";

test.describe("Keycloak Authentication", () => {
  test.beforeAll(async ({ rhdh }) => {
    await rhdh.configure({ auth: "keycloak" });
    await rhdh.deploy();
  });

  test.beforeEach(async ({ page, loginHelper }) => {
    await page.goto("/");
    await loginHelper.loginAsKeycloakUser();
  });

  test("should login with default user", async ({ uiHelper }) => {
    await uiHelper.verifyHeading(/Welcome/);
  });

  test("should show user profile", async ({ page }) => {
    await page.click("[data-testid='user-settings-menu']");
    await expect(page.getByText("test1")).toBeVisible();
  });
});
```

## Custom Users Test

```typescript
import { test, expect } from "rhdh-e2e-test-utils/test";
import { KeycloakHelper } from "rhdh-e2e-test-utils/keycloak";

let keycloak: KeycloakHelper;

test.describe("Custom Keycloak Users", () => {
  test.beforeAll(async ({ rhdh }) => {
    // Connect to Keycloak
    keycloak = new KeycloakHelper();
    await keycloak.connect({
      baseUrl: process.env.KEYCLOAK_BASE_URL!,
      username: "admin",
      password: "admin123",
    });

    // Create custom users
    await keycloak.createUser("rhdh", {
      username: "admin-user",
      password: "adminpass",
      groups: ["admins"],
    });

    await keycloak.createUser("rhdh", {
      username: "dev-user",
      password: "devpass",
      groups: ["developers"],
    });

    await rhdh.configure({ auth: "keycloak" });
    await rhdh.deploy();
  });

  test.afterAll(async () => {
    // Cleanup
    await keycloak.deleteUser("rhdh", "admin-user");
    await keycloak.deleteUser("rhdh", "dev-user");
  });

  test("admin can access settings", async ({ page, loginHelper, uiHelper }) => {
    await page.goto("/");
    await loginHelper.loginAsKeycloakUser("admin-user", "adminpass");
    await uiHelper.openSidebar("Settings");
    await expect(page.getByText("Admin")).toBeVisible();
  });

  test("developer sees limited options", async ({ page, loginHelper }) => {
    await page.goto("/");
    await loginHelper.loginAsKeycloakUser("dev-user", "devpass");
    await expect(page.getByText("Admin")).not.toBeVisible();
  });
});
```

## Login/Logout Flow

```typescript
import { test, expect } from "rhdh-e2e-test-utils/test";

test("complete auth flow", async ({ page, loginHelper, uiHelper }) => {
  // Start at login
  await page.goto("/");

  // Login
  await loginHelper.loginAsKeycloakUser("test1", "test1@123");

  // Verify logged in
  await uiHelper.verifyHeading(/Welcome/);

  // Use the app
  await uiHelper.openSidebar("Catalog");

  // Logout
  await loginHelper.signOut();

  // Verify logged out
  await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
});
```

## Default Credentials

| Username | Password | Groups |
|----------|----------|--------|
| `test1` | `test1@123` | developers |
| `test2` | `test2@123` | developers |
