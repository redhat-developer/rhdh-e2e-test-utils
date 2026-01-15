# Keycloak OIDC Testing

Test with Keycloak authentication for realistic auth flows.

## Overview

Keycloak provides:

- OIDC authentication
- User roles and groups
- Realistic login flows
- Session management

## Setup

### 1. Enable Keycloak Deployment

**.env:**
```bash
RHDH_VERSION="1.5"
INSTALLATION_METHOD="helm"
SKIP_KEYCLOAK_DEPLOYMENT=false
```

### 2. Configure RHDH for Keycloak

```typescript
test.beforeAll(async ({ rhdh }) => {
  await rhdh.configure({ auth: "keycloak" });
  await rhdh.deploy();
});
```

## Default Users

Keycloak creates these users automatically:

| Username | Password | Groups |
|----------|----------|--------|
| `test1` | `test1@123` | developers |
| `test2` | `test2@123` | developers |

## Login in Tests

```typescript
test.beforeEach(async ({ page, loginHelper }) => {
  await page.goto("/");
  await loginHelper.loginAsKeycloakUser();
});

// Or with specific credentials
test.beforeEach(async ({ page, loginHelper }) => {
  await page.goto("/");
  await loginHelper.loginAsKeycloakUser("test1", "test1@123");
});
```

## Creating Custom Users

```typescript
import { KeycloakHelper } from "rhdh-e2e-test-utils/keycloak";

test.beforeAll(async ({ rhdh }) => {
  const keycloak = new KeycloakHelper();

  // Connect to existing Keycloak
  await keycloak.connect({
    baseUrl: process.env.KEYCLOAK_BASE_URL!,
    username: "admin",
    password: "admin123",
  });

  // Create admin user
  await keycloak.createUser("rhdh", {
    username: "admin-user",
    password: "adminpass",
    email: "admin@example.com",
    groups: ["admins"],
  });

  // Create viewer user
  await keycloak.createUser("rhdh", {
    username: "viewer-user",
    password: "viewerpass",
    groups: ["viewers"],
  });

  await rhdh.configure({ auth: "keycloak" });
  await rhdh.deploy();
});
```

## Testing Role-Based Access

```typescript
test.describe("Admin access", () => {
  test.beforeEach(async ({ page, loginHelper }) => {
    await page.goto("/");
    await loginHelper.loginAsKeycloakUser("admin-user", "adminpass");
  });

  test("should see admin panel", async ({ uiHelper }) => {
    await uiHelper.openSidebar("Settings");
    await uiHelper.verifyText("Admin Panel");
  });
});

test.describe("Viewer access", () => {
  test.beforeEach(async ({ page, loginHelper }) => {
    await page.goto("/");
    await loginHelper.loginAsKeycloakUser("viewer-user", "viewerpass");
  });

  test("should not see admin panel", async ({ page }) => {
    await expect(page.getByText("Admin Panel")).not.toBeVisible();
  });
});
```

## Testing Logout

```typescript
test("should logout successfully", async ({ page, loginHelper, uiHelper }) => {
  await page.goto("/");
  await loginHelper.loginAsKeycloakUser();

  // Verify logged in
  await uiHelper.verifyHeading("Welcome");

  // Logout
  await loginHelper.signOut();

  // Verify logged out
  await expect(page.getByText("Sign in")).toBeVisible();
});
```

## Testing Session Expiry

```typescript
test("should handle expired session", async ({ page, loginHelper }) => {
  await page.goto("/");
  await loginHelper.loginAsKeycloakUser();

  // Clear cookies to simulate session expiry
  await page.context().clearCookies();

  // Navigate - should redirect to login
  await page.goto("/catalog");
  await expect(page.getByText("Sign in")).toBeVisible();
});
```

## Cleanup

```typescript
import { KeycloakHelper } from "rhdh-e2e-test-utils/keycloak";

test.afterAll(async () => {
  const keycloak = new KeycloakHelper();
  await keycloak.connect({
    baseUrl: process.env.KEYCLOAK_BASE_URL!,
    username: "admin",
    password: "admin123",
  });

  // Cleanup custom users
  await keycloak.deleteUser("rhdh", "admin-user");
  await keycloak.deleteUser("rhdh", "viewer-user");
});
```

## Best Practices

1. **Use default users for simple tests** - `test1`, `test2`
2. **Create custom users for RBAC tests** - Specific roles
3. **Clean up custom users** - Prevent state leakage
4. **Test logout flows** - Ensure proper session handling
5. **Test with multiple users** - Different permissions
