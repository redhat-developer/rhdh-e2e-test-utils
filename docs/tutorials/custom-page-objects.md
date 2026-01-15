# Custom Page Objects

Create reusable page objects for your plugin.

## Why Page Objects?

- **Encapsulation** - Hide implementation details
- **Reusability** - Use across multiple tests
- **Maintainability** - Update in one place
- **Readability** - Clear, descriptive methods

## Basic Structure

```typescript
import { Page, Locator, expect } from "@playwright/test";

export class MyPluginPage {
  private readonly page: Page;
  private readonly heading: Locator;
  private readonly submitButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { name: "My Plugin" });
    this.submitButton = page.getByRole("button", { name: "Submit" });
  }

  async go(): Promise<void> {
    await this.page.goto("/my-plugin");
    await this.heading.waitFor();
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
  }
}
```

## Complete Example

**tests/pages/tech-radar-page.ts:**
```typescript
import { Page, Locator, expect } from "@playwright/test";

export class TechRadarPage {
  private readonly page: Page;
  private readonly radarHeading: Locator;
  private readonly radarCanvas: Locator;
  private readonly quadrantButtons: Locator;

  constructor(page: Page) {
    this.page = page;
    this.radarHeading = page.getByRole("heading", { name: "Tech Radar" });
    this.radarCanvas = page.locator("svg.tech-radar");
    this.quadrantButtons = page.locator(".quadrant-button");
  }

  async go(): Promise<void> {
    await this.page.goto("/tech-radar");
    await this.radarHeading.waitFor();
  }

  async waitForRadarLoaded(): Promise<void> {
    await this.radarCanvas.waitFor();
  }

  async selectQuadrant(name: string): Promise<void> {
    await this.page.getByRole("button", { name }).click();
  }

  async verifyEntryVisible(entryName: string): Promise<void> {
    await expect(this.page.getByText(entryName)).toBeVisible();
  }

  async hoverEntry(entryName: string): Promise<void> {
    await this.page.getByText(entryName).hover();
  }

  async verifyTooltip(expectedText: string): Promise<void> {
    await expect(this.page.locator(".tooltip")).toContainText(expectedText);
  }

  async getQuadrantCount(): Promise<number> {
    return this.quadrantButtons.count();
  }
}
```

## Using in Tests

```typescript
import { test, expect } from "rhdh-e2e-test-utils/test";
import { TechRadarPage } from "../pages/tech-radar-page";

test.describe("Tech Radar", () => {
  test.beforeAll(async ({ rhdh }) => {
    await rhdh.configure({ auth: "keycloak" });
    await rhdh.deploy();
  });

  test.beforeEach(async ({ loginHelper }) => {
    await loginHelper.loginAsKeycloakUser();
  });

  test("should display radar", async ({ page }) => {
    const techRadarPage = new TechRadarPage(page);

    await techRadarPage.go();
    await techRadarPage.waitForRadarLoaded();
    await techRadarPage.verifyEntryVisible("TypeScript");
  });

  test("should show tooltip on hover", async ({ page }) => {
    const techRadarPage = new TechRadarPage(page);

    await techRadarPage.go();
    await techRadarPage.hoverEntry("TypeScript");
    await techRadarPage.verifyTooltip("Adopt");
  });
});
```

## Extending Built-in Page Objects

```typescript
import { CatalogPage } from "rhdh-e2e-test-utils/pages";
import { Page, expect } from "@playwright/test";

export class ExtendedCatalogPage extends CatalogPage {
  constructor(page: Page) {
    super(page);
  }

  async verifyComponentHasTag(componentName: string, tag: string): Promise<void> {
    await this.goToByName(componentName);
    await expect(this.page.getByText(tag)).toBeVisible();
  }

  async countComponents(): Promise<number> {
    return this.page.locator("table tbody tr").count();
  }
}
```

## Composing Page Objects

```typescript
import { Page } from "@playwright/test";
import { CatalogPage } from "rhdh-e2e-test-utils/pages";
import { TechRadarPage } from "./tech-radar-page";

export class AppPages {
  readonly catalog: CatalogPage;
  readonly techRadar: TechRadarPage;

  constructor(page: Page) {
    this.catalog = new CatalogPage(page);
    this.techRadar = new TechRadarPage(page);
  }
}

// Usage
test("navigation", async ({ page }) => {
  const app = new AppPages(page);

  await app.catalog.go();
  await app.techRadar.go();
});
```

## Best Practices

1. **One page object per page** - Clear responsibility
2. **Use descriptive method names** - `verifyUserLoggedIn()` not `check()`
3. **Return Promises** - All async methods
4. **Keep locators private** - Expose methods, not elements
5. **Use waitFor** - Ensure elements are ready
6. **Avoid test logic** - No assertions in constructors
