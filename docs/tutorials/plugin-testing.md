# Testing a Plugin

Complete guide to testing an RHDH plugin end-to-end.

## Overview

This tutorial covers:

1. Setting up the test project
2. Configuring your plugin
3. Writing comprehensive tests
4. Running and debugging

## Step 1: Project Setup

```bash
cd your-plugin-workspace
mkdir e2e-tests && cd e2e-tests
yarn init -y
yarn add @playwright/test rhdh-e2e-test-utils typescript dotenv
```

## Step 2: Configuration

**playwright.config.ts:**
```typescript
import { defineConfig } from "rhdh-e2e-test-utils/playwright-config";
import dotenv from "dotenv";

dotenv.config({ path: `${import.meta.dirname}/.env` });

export default defineConfig({
  projects: [
    {
      name: "my-plugin",
    },
  ],
});
```

**.env:**
```bash
RHDH_VERSION="1.5"
INSTALLATION_METHOD="helm"
SKIP_KEYCLOAK_DEPLOYMENT=false
```

## Step 3: Plugin Configuration

**tests/config/dynamic-plugins.yaml:**
```yaml
includes:
  - dynamic-plugins.default.yaml

plugins:
  # Your frontend plugin
  - package: ./dynamic-plugins/dist/my-plugin
    disabled: false
    pluginConfig:
      dynamicPlugins:
        frontend:
          my-plugin:
            mountPoints:
              - mountPoint: entity.page.overview/cards
                importName: MyPluginCard
                config:
                  layout:
                    gridColumnEnd: span 4

  # Your backend plugin (if any)
  - package: ./dynamic-plugins/dist/my-plugin-backend-dynamic
    disabled: false
```

**tests/config/app-config-rhdh.yaml:**
```yaml
app:
  title: My Plugin E2E Tests

# Plugin-specific configuration
myPlugin:
  apiUrl: ${MY_PLUGIN_API_URL:-http://localhost:8080}
  enabled: true
```

## Step 4: Write Tests

**tests/specs/my-plugin.spec.ts:**
```typescript
import { test, expect } from "rhdh-e2e-test-utils/test";

test.describe("My Plugin", () => {
  test.beforeAll(async ({ rhdh }) => {
    await rhdh.configure({
      auth: "keycloak",
      appConfig: "tests/config/app-config-rhdh.yaml",
      dynamicPlugins: "tests/config/dynamic-plugins.yaml",
    });
    await rhdh.deploy();
  });

  test.beforeEach(async ({ page, loginHelper }) => {
    await page.goto("/");
    await loginHelper.loginAsKeycloakUser();
  });

  test("should display plugin in sidebar", async ({ uiHelper }) => {
    await uiHelper.openSidebar("My Plugin");
    await uiHelper.verifyHeading("My Plugin");
  });

  test("should show plugin card on entity page", async ({ page, uiHelper }) => {
    await uiHelper.openSidebar("Catalog");
    await page.click("text=example-component");
    await uiHelper.verifyTextinCard("My Plugin", "Plugin content");
  });

  test("should handle user interactions", async ({ page, uiHelper }) => {
    await uiHelper.openSidebar("My Plugin");
    await uiHelper.clickButton("Perform Action");
    await uiHelper.verifyText("Action completed");
  });
});
```

## Step 5: Add Helper Functions

**tests/helpers/my-plugin-helpers.ts:**
```typescript
import { Page, expect } from "@playwright/test";

export async function verifyPluginData(page: Page, expectedData: string[]) {
  for (const item of expectedData) {
    await expect(page.getByText(item)).toBeVisible();
  }
}

export async function performPluginAction(page: Page, action: string) {
  await page.getByRole("button", { name: action }).click();
  await page.waitForLoadState("networkidle");
}
```

## Step 6: Create Custom Page Object

**tests/pages/my-plugin-page.ts:**
```typescript
import { Page, Locator, expect } from "@playwright/test";

export class MyPluginPage {
  private readonly page: Page;
  private readonly heading: Locator;
  private readonly dataTable: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { name: "My Plugin" });
    this.dataTable = page.locator("table.my-plugin-data");
  }

  async go(): Promise<void> {
    await this.page.goto("/my-plugin");
    await this.heading.waitFor();
  }

  async verifyDataRow(text: string): Promise<void> {
    await expect(this.dataTable.getByText(text)).toBeVisible();
  }

  async clickRow(text: string): Promise<void> {
    await this.dataTable.getByText(text).click();
  }
}
```

## Step 7: Run Tests

```bash
# Run all tests
yarn playwright test

# Run specific file
yarn playwright test my-plugin.spec.ts

# Run with UI
yarn playwright test --ui

# Run headed
yarn playwright test --headed
```

## Best Practices

1. **Use descriptive test names** - Explain what's being tested
2. **Keep tests independent** - Each test should work alone
3. **Use page objects** - For complex page interactions
4. **Handle async properly** - Always await assertions
5. **Clean up test data** - Remove created entities

## Debugging Tips

### Screenshots

```typescript
test("debug test", async ({ page }) => {
  await page.screenshot({ path: "debug.png" });
});
```

### Pause for Inspection

```typescript
test("debug test", async ({ page }) => {
  await page.pause(); // Opens Playwright inspector
});
```

### Slow Down

```typescript
import { defineConfig } from "rhdh-e2e-test-utils/playwright-config";

export default defineConfig({
  use: {
    launchOptions: {
      slowMo: 500, // 500ms between actions
    },
  },
  projects: [{ name: "my-plugin" }],
});
```

## Next Steps

- [Multi-Project Setup](/tutorials/multi-project-setup)
- [CI/CD Integration](/tutorials/ci-cd-integration)
