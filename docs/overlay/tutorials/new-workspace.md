# Adding Tests to a New Workspace

::: tip Overlay Documentation
This page covers writing tests within rhdh-plugin-export-overlays.
For using @red-hat-developer-hub/e2e-test-utils in external projects, see the [Guide](/guide/).
:::

This tutorial walks you through adding E2E tests to a new plugin workspace in the overlay repository.

## Prerequisites

- Node.js 22+ installed
- Yarn 3+ installed
- Access to an OpenShift cluster
- `oc`, `kubectl`, and `helm` CLI tools installed

## Step 1: Navigate to Your Workspace

```bash
cd rhdh-plugin-export-overlays/workspaces/<your-plugin>
```

## Step 2: Create Directory Structure

```bash
mkdir -p e2e-tests/tests/{config,specs}
cd e2e-tests
```

## Step 3: Create package.json

Create `package.json` with the following content:

```json
{
  "name": "<your-plugin>-e2e-tests",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=22",
    "yarn": ">=3"
  },
  "packageManager": "yarn@4.12.0",
  "description": "E2E tests for <your-plugin>",
  "scripts": {
    "test": "playwright test",
    "report": "playwright show-report",
    "test:ui": "playwright test --ui",
    "test:headed": "playwright test --headed",
    "lint:check": "eslint .",
    "lint:fix": "eslint . --fix",
    "prettier:check": "prettier --check .",
    "prettier:fix": "prettier --write .",
    "tsc:check": "tsc --noEmit",
    "check": "yarn tsc:check && yarn lint:check && yarn prettier:check"
  },
  "devDependencies": {
    "@eslint/js": "10.0.1",
    "@playwright/test": "1.59.1",
    "@red-hat-developer-hub/e2e-test-utils": "<latest-version>",
    "@types/node": "25.5.2",
    "dotenv": "17.4.1",
    "eslint": "10.2.0",
    "eslint-plugin-check-file": "3.3.1",
    "eslint-plugin-playwright": "2.10.1",
    "prettier": "3.8.1",
    "typescript": "6.0.2",
    "typescript-eslint": "8.58.1"
  }
}
```

Replace `<your-plugin>` with your plugin name.
Replate `<latest-version>` with the latest available version of this library.

## Step 4: Create Configuration Files

### playwright.config.ts

```typescript
import { defineConfig } from "@red-hat-developer-hub/e2e-test-utils/playwright-config";
import dotenv from "dotenv";

dotenv.config({ path: `${import.meta.dirname}/.env` });

export default defineConfig({
  projects: [
    {
      name: "<your-plugin>",
    },
  ],
});
```

### tsconfig.json

```json
{
  "extends": "@red-hat-developer-hub/e2e-test-utils/tsconfig",
  "include": ["**/*.ts"]
}
```

### eslint.config.js

```javascript
import { createEslintConfig } from "@red-hat-developer-hub/e2e-test-utils/eslint";

export default createEslintConfig(import.meta.dirname);
```

### .yarnrc.yml

```yaml
nodeLinker: node-modules
```

### .env

Create an empty `.env` file:

```bash
touch .env
```

## Step 5: Create Your First Test

Create `tests/specs/<your-plugin>.spec.ts`:

```typescript
import { test, expect } from "@red-hat-developer-hub/e2e-test-utils/test";

test.describe("Test <your-plugin>", () => {
  test.beforeAll(async ({ rhdh }) => {
    await rhdh.configure({ auth: "keycloak" });
    await rhdh.deploy();
  });

  test.beforeEach(async ({ loginHelper }) => {
    await loginHelper.loginAsKeycloakUser();
  });

  test("Verify plugin loads", async ({ uiHelper }) => {
    // Navigate to your plugin
    await uiHelper.openSidebar("<Your Plugin>");

    // Verify the plugin loaded
    await uiHelper.verifyHeading("<Expected Heading>");
  });

  test("Verify key functionality", async ({ page, uiHelper }) => {
    await uiHelper.openSidebar("<Your Plugin>");

    // Add assertions for your plugin's functionality
    await expect(page.locator('text="Expected Content"')).toBeVisible();
  });
});
```

## Step 6: Install Dependencies

```bash
yarn install
npx playwright install
```

## Step 7: Run Tests

Login to your cluster:

```bash
oc login <cluster-url>
```

Run the tests:

```bash
yarn test
```

## Step 8: View Results

View the HTML report:

```bash
yarn report
```

## Final Directory Structure

After completing these steps, your directory should look like:

```
workspaces/<your-plugin>/
├── metadata/                    # Plugin metadata (auto-generates config)
│   └── plugin.yaml
├── plugins/
│   └── <your-plugin>/           # Plugin source
└── e2e-tests/
    ├── .env
    ├── .yarnrc.yml
    ├── eslint.config.js
    ├── package.json
    ├── playwright.config.ts
    ├── tsconfig.json
    ├── yarn.lock
    └── tests/
        ├── config/              # Optional - only if needed
        └── specs/
            └── <your-plugin>.spec.ts
```

::: tip Configuration Files Are Optional
The `tests/config/` directory can be empty or omitted entirely. Configuration is auto-generated from plugin metadata. Only add files when you need to override defaults or configure external services.

See [Configuration Files](/overlay/test-structure/configuration-files) for details.
:::

## Next Steps

- [Plugin Configuration](./plugin-config) - Configure plugin-specific settings
- [Running Tests Locally](./running-locally) - Development workflow tips
- [CI/CD Pipeline](./ci-pipeline) - OpenShift CI integration

## Related Pages

- [Directory Layout](/overlay/test-structure/directory-layout) - Full structure reference
- [Spec Files](/overlay/test-structure/spec-files) - Writing tests
- [Tech Radar Example](/overlay/examples/tech-radar) - Complete working example
