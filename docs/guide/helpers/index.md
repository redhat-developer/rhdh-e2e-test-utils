# Helpers Overview

The package provides helper classes for common testing operations in RHDH.

## Available Helpers

| Helper | Purpose |
|--------|---------|
| [UIhelper](/guide/helpers/ui-helper) | Material-UI component interactions |
| [LoginHelper](/guide/helpers/login-helper) | Authentication flows |
| [APIHelper](/guide/helpers/api-helper) | GitHub and Backstage API operations |
| [AuthApiHelper](/guide/helpers/auth-api-helper) | Retrieve Backstage identity tokens |
| [RbacApiHelper](/guide/helpers/rbac-api-helper) | Manage RBAC roles and policies |

## Importing Helpers

```typescript
// Via fixtures (recommended)
import { test } from "@red-hat-developer-hub/e2e-test-utils/test";

test("example", async ({ uiHelper, loginHelper }) => {
  await loginHelper.loginAsKeycloakUser();
  await uiHelper.verifyHeading("Welcome");
});

// Direct import
import { UIhelper, LoginHelper, APIHelper, AuthApiHelper, RbacApiHelper, setupBrowser } from "@red-hat-developer-hub/e2e-test-utils/helpers";

const uiHelper = new UIhelper(page);
const loginHelper = new LoginHelper(page);
```

## UIhelper

Provides methods for interacting with Material-UI components in RHDH:

```typescript
// Wait and verify
await uiHelper.waitForLoad();
await uiHelper.verifyHeading("Catalog");
await uiHelper.verifyText("Welcome to RHDH");

// Navigation
await uiHelper.openSidebar("Catalog");
await uiHelper.clickTab("Overview");

// Form interactions
await uiHelper.fillTextInputByLabel("Name", "my-component");
await uiHelper.selectMuiBox("Kind", "Component");
await uiHelper.clickButton("Submit");

// Table operations
await uiHelper.verifyRowsInTable(["row1", "row2"]);
await uiHelper.verifyCellsInTable(["cell1", "cell2"]);
```

[Learn more about UIhelper →](/guide/helpers/ui-helper)

## LoginHelper

Handles authentication for different providers:

```typescript
// Guest authentication
await loginHelper.loginAsGuest();

// Keycloak authentication
await loginHelper.loginAsKeycloakUser();
await loginHelper.loginAsKeycloakUser("custom-user", "password");

// GitHub authentication
await loginHelper.loginAsGithubUser();

// Sign out
await loginHelper.signOut();
```

[Learn more about LoginHelper →](/guide/helpers/login-helper)

## APIHelper

Provides API operations for GitHub and Backstage:

```typescript
// GitHub operations
await APIHelper.createGitHubRepo("owner", "repo-name");
await APIHelper.deleteGitHubRepo("owner", "repo-name");
const prs = await APIHelper.getGitHubPRs("owner", "repo", "open");

// Backstage catalog operations
const apiHelper = new APIHelper();
await apiHelper.setBaseUrl(rhdhUrl);
await apiHelper.setStaticToken(token);

const users = await apiHelper.getAllCatalogUsersFromAPI();
const groups = await apiHelper.getAllCatalogGroupsFromAPI();
```

[Learn more about APIHelper →](/guide/helpers/api-helper)

## AuthApiHelper

Retrieves Backstage identity tokens from RHDH's auth API:

```typescript
import { AuthApiHelper } from "@red-hat-developer-hub/e2e-test-utils/helpers";

const authApiHelper = new AuthApiHelper(page);

// Using default OIDC provider
const token = await authApiHelper.getToken();

// Using a specific provider
const token = await authApiHelper.getToken("github");
```

[Learn more about AuthApiHelper →](/guide/helpers/auth-api-helper)

## RbacApiHelper

Manages RBAC roles and policies via the RHDH Permission API. Built with an async factory method that requires a Backstage identity token:

```typescript
import { AuthApiHelper, RbacApiHelper, Response, type Policy } from "@red-hat-developer-hub/e2e-test-utils/helpers";

const authApiHelper = new AuthApiHelper(page);
const token = await authApiHelper.getToken();
const rbacApiHelper = await RbacApiHelper.build(token);

// Retrieve policies and clean up
const apiResponse = await rbacApiHelper.getPoliciesByRole("my-role");
const policies = await Response.removeMetadataFromResponse(apiResponse) as Policy[];
await rbacApiHelper.deletePolicy("my-role", policies);
await rbacApiHelper.deleteRole("my-role");
```

[Learn more about RbacApiHelper →](/guide/helpers/rbac-api-helper)

## setupBrowser

Utility for shared browser context in serial tests:

```typescript
import { test } from "@playwright/test";
import { setupBrowser, LoginHelper } from "@red-hat-developer-hub/e2e-test-utils/helpers";
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

test("first test", async () => {
  await page.goto("/catalog");
  // Already logged in
});
```

## When to Use Each Helper

| Scenario | Helper |
|----------|--------|
| Click buttons, verify text | UIhelper |
| Login/logout operations | LoginHelper |
| Create GitHub repos | APIHelper |
| Query Backstage catalog | APIHelper |
| Interact with tables | UIhelper |
| Fill forms | UIhelper |
| Retrieve a Backstage identity token | AuthApiHelper |
| Clean up RBAC roles/policies after tests | RbacApiHelper |
