# Basic Plugin Test Example

::: tip Overlay Documentation
This page covers writing tests within rhdh-plugin-export-overlays.
For using rhdh-e2e-test-utils in external projects, see the [Guide](/guide/).
:::

This is a minimal example of E2E tests for a simple plugin that doesn't require external services.

## Overview

This example shows the simplest possible E2E test setup for a plugin in the overlay repository. Use this as a starting point for plugins that:
- Don't require external data providers
- Don't need custom Kubernetes resources
- Have straightforward UI interactions

## Directory Structure

```
workspaces/<plugin>/e2e-tests/
├── .env
├── .yarnrc.yml
├── eslint.config.js
├── package.json
├── playwright.config.ts
├── tsconfig.json
└── tests/
    ├── config/
    │   └── app-config-rhdh.yaml
    └── specs/
        └── <plugin>.spec.ts
```

## Configuration Files

### package.json

```json
{
  "name": "<plugin>-e2e-tests",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=22",
    "yarn": ">=3"
  },
  "packageManager": "yarn@3.8.7",
  "description": "E2E tests for <plugin>",
  "scripts": {
    "test": "playwright test",
    "report": "playwright show-report",
    "test:ui": "playwright test --ui",
    "test:headed": "playwright test --headed",
    "lint:check": "eslint .",
    "lint:fix": "eslint . --fix",
    "prettier:check": "prettier --check .",
    "prettier:fix": "prettier --write .",
    "check": "tsc --noEmit && yarn lint:check && yarn prettier:check"
  },
  "devDependencies": {
    "@eslint/js": "^9.39.2",
    "@playwright/test": "1.57.0",
    "@types/node": "^24.10.1",
    "dotenv": "^16.4.7",
    "eslint": "^9.39.2",
    "eslint-plugin-check-file": "^3.3.1",
    "eslint-plugin-playwright": "^2.4.0",
    "prettier": "^3.7.4",
    "rhdh-e2e-test-utils": "1.1.9",
    "typescript": "^5.9.3",
    "typescript-eslint": "^8.50.0"
  }
}
```

### playwright.config.ts

```typescript
import { defineConfig } from "rhdh-e2e-test-utils/playwright-config";
import dotenv from "dotenv";

dotenv.config({ path: `${import.meta.dirname}/.env` });

export default defineConfig({
  projects: [
    {
      name: "<plugin>",
    },
  ],
});
```

### tsconfig.json

```json
{
  "extends": "rhdh-e2e-test-utils/tsconfig",
  "include": ["**/*.ts"]
}
```

### eslint.config.js

```javascript
import { createEslintConfig } from "rhdh-e2e-test-utils/eslint";

export default createEslintConfig(import.meta.dirname);
```

### .yarnrc.yml

```yaml
nodeLinker: node-modules
```

## RHDH Configuration

### tests/config/app-config-rhdh.yaml

Minimal configuration for a simple plugin:

```yaml
# RHDH app config for <plugin>
# This file merges with defaults from rhdh-e2e-test-utils

app:
  title: RHDH <Plugin> Test Instance

# Add plugin-specific configuration if needed
# <pluginName>:
#   setting: value
```

## Test Specification

### tests/specs/\<plugin\>.spec.ts

Simple test file:

```typescript
import { test, expect } from "rhdh-e2e-test-utils/test";

test.describe("Test <plugin>", () => {
  // Deploy RHDH once per worker
  test.beforeAll(async ({ rhdh }) => {
    await rhdh.configure({ auth: "keycloak" });
    await rhdh.deploy();
  });

  // Login before each test
  test.beforeEach(async ({ loginHelper }) => {
    await loginHelper.loginAsKeycloakUser();
  });

  test("Plugin loads correctly", async ({ uiHelper }) => {
    // Navigate to the plugin
    await uiHelper.openSidebar("<Plugin Name>");

    // Verify the plugin loaded
    await uiHelper.verifyHeading("<Expected Heading>");
  });

  test("Verify main content", async ({ page, uiHelper }) => {
    await uiHelper.openSidebar("<Plugin Name>");

    // Verify specific content
    await uiHelper.verifyText("Expected text content");

    // Or use Playwright locators directly
    await expect(page.locator('text="Some specific text"')).toBeVisible();
  });

  test("Test user interaction", async ({ page, uiHelper }) => {
    await uiHelper.openSidebar("<Plugin Name>");

    // Click a button
    await uiHelper.clickButton("Action");

    // Verify result
    await uiHelper.verifyText("Action completed");
  });
});
```

## Using Guest Authentication

For simpler tests without Keycloak:

```typescript
import { test, expect } from "rhdh-e2e-test-utils/test";

test.describe("Test <plugin>", () => {
  test.beforeAll(async ({ rhdh }) => {
    // Use guest auth instead of Keycloak
    await rhdh.configure({ auth: "guest" });
    await rhdh.deploy();
  });

  test.beforeEach(async ({ loginHelper }) => {
    // Login as guest
    await loginHelper.loginAsGuest();
  });

  test("Plugin loads", async ({ uiHelper }) => {
    await uiHelper.openSidebar("<Plugin Name>");
    await uiHelper.verifyHeading("<Expected Heading>");
  });
});
```

## Common UIhelper Methods

| Method | Description |
|--------|-------------|
| `openSidebar(name)` | Click sidebar navigation item |
| `verifyHeading(text)` | Verify heading text is visible |
| `verifyText(text)` | Verify text is visible |
| `clickButton(name)` | Click button by name |
| `clickLink(text)` | Click link by text |
| `fillTextInputByLabel(label, value)` | Fill input field |
| `waitForLoad()` | Wait for page to finish loading |

See [UIhelper API](/api/helpers/ui-helper) for the full API reference.

## Running Tests

```bash
cd workspaces/<plugin>/e2e-tests

# Install
yarn install
npx playwright install

# Login to cluster
oc login <cluster-url>

# Run
yarn test

# View report
yarn report
```

## Adding More Test Cases

Expand your tests as needed:

```typescript
test("Navigate through tabs", async ({ uiHelper }) => {
  await uiHelper.openSidebar("<Plugin Name>");
  await uiHelper.clickTab("Details");
  await uiHelper.verifyText("Details content");
});

test("Search functionality", async ({ uiHelper }) => {
  await uiHelper.openSidebar("<Plugin Name>");
  await uiHelper.searchInputPlaceholder("Search...", "query");
  await uiHelper.verifyText("Search results");
});

test("Table data", async ({ uiHelper }) => {
  await uiHelper.openSidebar("<Plugin Name>");
  await uiHelper.verifyRowsInTable(["row1", "row2", "row3"]);
});
```

## Related Pages

- [Tech Radar Example](./tech-radar) - More complex example with external services
- [Adding Tests to New Workspace](/overlay/tutorials/new-workspace) - Step-by-step tutorial
- [Spec Files](/overlay/test-structure/spec-files) - Writing tests
