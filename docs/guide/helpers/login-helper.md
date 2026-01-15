# LoginHelper

The `LoginHelper` class handles authentication flows for different providers in RHDH.

## Getting LoginHelper

```typescript
// Via fixture (recommended)
import { test } from "rhdh-e2e-test-utils/test";

test("example", async ({ loginHelper }) => {
  await loginHelper.loginAsKeycloakUser();
});

// Direct instantiation
import { LoginHelper } from "rhdh-e2e-test-utils/helpers";

const loginHelper = new LoginHelper(page);
```

## Authentication Methods

### Guest Authentication

#### `loginAsGuest()`

Login using guest authentication:

```typescript
await loginHelper.loginAsGuest();
```

This clicks the "Enter" button on the guest login page.

### Keycloak Authentication

#### `loginAsKeycloakUser(username?, password?)`

Login using Keycloak OIDC:

```typescript
// Default credentials (test1/test1@123)
await loginHelper.loginAsKeycloakUser();

// Custom credentials
await loginHelper.loginAsKeycloakUser("test1", "test1@123");
await loginHelper.loginAsKeycloakUser("admin-user", "adminpass");
```

Environment variables for defaults:
- `KEYCLOAK_USER_NAME` - Default username (fallback: `test1`)
- `KEYCLOAK_USER_PASSWORD` - Default password (fallback: `test1@123`)

### GitHub Authentication

#### `loginAsGithubUser()`

Login using GitHub OAuth:

```typescript
await loginHelper.loginAsGithubUser();
```

Required environment variables:
- `GH_USER_NAME` - GitHub username
- `GH_USER_PASSWORD` - GitHub password
- `GH_2FA_SECRET` - GitHub 2FA secret (for OTP generation)

::: warning
GitHub login requires 2FA secret for automated OTP generation. This is more complex to set up.
:::

## Sign Out

### `signOut()`

Sign out of RHDH:

```typescript
await loginHelper.signOut();
```

This navigates to the user menu and clicks sign out.

## Usage Patterns

### Login Before Each Test

```typescript
import { test } from "rhdh-e2e-test-utils/test";

test.beforeEach(async ({ loginHelper }) => {
  await loginHelper.loginAsKeycloakUser();
});

test("test 1", async ({ page }) => {
  // Already logged in
});

test("test 2", async ({ page }) => {
  // Already logged in
});
```

### Login Once for Serial Tests

```typescript
import { test } from "@playwright/test";
import { setupBrowser, LoginHelper } from "rhdh-e2e-test-utils/helpers";
import type { Page, BrowserContext } from "@playwright/test";

test.describe.configure({ mode: "serial" });

let page: Page;
let context: BrowserContext;

test.beforeAll(async ({ browser }, testInfo) => {
  ({ page, context } = await setupBrowser(browser, testInfo));

  const loginHelper = new LoginHelper(page);
  await page.goto("/");
  await loginHelper.loginAsKeycloakUser();
});

test.afterAll(async () => {
  await context.close();
});

test("test 1", async () => {
  // Session persists
  await page.goto("/catalog");
});

test("test 2", async () => {
  // Still logged in
  await page.goto("/settings");
});
```

### Different Users in Different Tests

```typescript
import { test } from "rhdh-e2e-test-utils/test";

test("as developer", async ({ page, loginHelper, uiHelper }) => {
  await page.goto("/");
  await loginHelper.loginAsKeycloakUser("test1", "test1@123");
  await uiHelper.openSidebar("Catalog");
  // Developer view
  await loginHelper.signOut();
});

test("as admin", async ({ page, loginHelper, uiHelper }) => {
  await page.goto("/");
  await loginHelper.loginAsKeycloakUser("admin", "adminpass");
  await uiHelper.openSidebar("Settings");
  // Admin view
});
```

### Handling Login Redirects

The LoginHelper handles OAuth redirects automatically. After calling a login method, you'll be on the RHDH home page.

```typescript
test("login flow", async ({ page, loginHelper }) => {
  await page.goto("/");

  // This handles:
  // 1. Click login button
  // 2. Redirect to Keycloak
  // 3. Fill credentials
  // 4. Submit
  // 5. Redirect back to RHDH
  await loginHelper.loginAsKeycloakUser();

  // Now on RHDH home page
  await expect(page).toHaveURL(/.*\/$/);
});
```

## Environment Variables

### Keycloak

| Variable | Description | Default |
|----------|-------------|---------|
| `KEYCLOAK_USER_NAME` | Default username | `test1` |
| `KEYCLOAK_USER_PASSWORD` | Default password | `test1@123` |

### GitHub

| Variable | Description | Required |
|----------|-------------|----------|
| `GH_USER_NAME` | GitHub username | Yes |
| `GH_USER_PASSWORD` | GitHub password | Yes |
| `GH_2FA_SECRET` | 2FA secret for OTP | Yes |

## Troubleshooting

### Login Timeout

```
Error: Login timed out waiting for redirect
```

**Solution:**
1. Verify Keycloak is running
2. Check RHDH is configured for Keycloak auth
3. Verify credentials are correct

### Guest Login Not Available

```
Error: Guest login button not found
```

**Solution:** Ensure RHDH is configured with `auth: "guest"`.

### Keycloak Login Page Not Shown

```
Error: Keycloak login form not found
```

**Solution:**
1. Check Keycloak environment variables are set
2. Verify RHDH is configured with `auth: "keycloak"`
3. Check Keycloak is accessible

### Already Logged In

If tests assume fresh login state but session persists:

```typescript
test.beforeEach(async ({ page, loginHelper }) => {
  // Clear cookies before each test
  await page.context().clearCookies();
  await page.goto("/");
  await loginHelper.loginAsKeycloakUser();
});
```
