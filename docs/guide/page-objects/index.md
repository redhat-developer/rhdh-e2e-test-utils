# Page Objects Overview

The package provides pre-built page object classes for common RHDH pages.

## Available Page Objects

| Page Object | Purpose |
|------------|---------|
| [CatalogPage](/guide/page-objects/catalog-page) | Software catalog navigation |
| [HomePage](/guide/page-objects/home-page) | Home page interactions |
| [CatalogImportPage](/guide/page-objects/catalog-import-page) | Component registration |
| [ExtensionsPage](/guide/page-objects/extensions-page) | Plugin management |
| [NotificationPage](/guide/page-objects/notification-page) | Notification management |

## Importing Page Objects

```typescript
import {
  CatalogPage,
  HomePage,
  CatalogImportPage,
  ExtensionsPage,
  NotificationPage,
} from "rhdh-e2e-test-utils/pages";
```

## Usage Pattern

Page objects are instantiated with a Playwright `Page` object:

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

## When to Use Page Objects

Page objects are useful when:

- You need specialized navigation or interaction with a specific RHDH page
- You want cleaner, more readable tests
- You're performing multiple operations on the same page

For simple interactions, `UIhelper` may be sufficient:

```typescript
// Using UIhelper
await uiHelper.openSidebar("Catalog");
await uiHelper.verifyHeading("Catalog");

// Using CatalogPage
const catalogPage = new CatalogPage(page);
await catalogPage.go();
```

## Creating Custom Page Objects

You can create your own page objects for plugin-specific pages:

```typescript
import { Page, Locator, expect } from "@playwright/test";

export class MyPluginPage {
  private readonly page: Page;
  private readonly heading: Locator;
  private readonly actionButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { name: "My Plugin" });
    this.actionButton = page.getByRole("button", { name: "Take Action" });
  }

  async go(): Promise<void> {
    await this.page.goto("/my-plugin");
    await this.heading.waitFor();
  }

  async performAction(): Promise<void> {
    await this.actionButton.click();
  }

  async verifyResult(expected: string): Promise<void> {
    await expect(this.page.getByText(expected)).toBeVisible();
  }
}
```

Usage:

```typescript
import { test } from "rhdh-e2e-test-utils/test";
import { MyPluginPage } from "./pages/my-plugin-page";

test("my plugin test", async ({ page }) => {
  const myPluginPage = new MyPluginPage(page);
  await myPluginPage.go();
  await myPluginPage.performAction();
  await myPluginPage.verifyResult("Success");
});
```
