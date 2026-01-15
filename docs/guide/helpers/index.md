# Helpers Overview

The package provides helper classes for common testing operations in RHDH.

## Available Helpers

| Helper | Purpose |
|--------|---------|
| [UIhelper](/guide/helpers/ui-helper) | Material-UI component interactions |
| [LoginHelper](/guide/helpers/login-helper) | Authentication flows |
| [APIHelper](/guide/helpers/api-helper) | GitHub and Backstage API operations |

## Importing Helpers

```typescript
// Via fixtures (recommended)
import { test } from "rhdh-e2e-test-utils/test";

test("example", async ({ uiHelper, loginHelper }) => {
  await loginHelper.loginAsKeycloakUser();
  await uiHelper.verifyHeading("Welcome");
});

// Direct import
import { UIhelper, LoginHelper, APIHelper, setupBrowser } from "rhdh-e2e-test-utils/helpers";

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

## setupBrowser

Utility for shared browser context in serial tests:

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
