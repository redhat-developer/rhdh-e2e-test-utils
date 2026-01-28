# Quick Start

This guide walks you through creating your first E2E test for an RHDH plugin.

## Prerequisites

Before starting, ensure you have:

- Node.js >= 22
- Yarn >= 3
- Access to an OpenShift cluster
- `oc`, `kubectl`, and `helm` CLI tools installed

## Step 1: Set Up Your Project

```bash
mkdir my-plugin-e2e && cd my-plugin-e2e
yarn init -y
yarn add @playwright/test rhdh-e2e-test-utils typescript
```

## Step 2: Create Playwright Configuration

Create `playwright.config.ts`:

```typescript
import { defineConfig } from "rhdh-e2e-test-utils/playwright-config";
import dotenv from "dotenv";

dotenv.config({ path: `${import.meta.dirname}/.env` });

export default defineConfig({
  projects: [
    {
      name: "my-plugin", // Also used as Kubernetes namespace
    },
  ],
});
```

## Step 3: Create Configuration Files

Create `tests/config/app-config-rhdh.yaml`:

```yaml
app:
  title: My Plugin Test Instance

# Add plugin-specific configuration here
```

Create `tests/config/dynamic-plugins.yaml`:

```yaml
includes:
  - dynamic-plugins.default.yaml

plugins:
  - package: ./dynamic-plugins/dist/my-frontend-plugin
    disabled: false
  - package: ./dynamic-plugins/dist/my-backend-plugin-dynamic
    disabled: false
```

Create `tests/config/rhdh-secrets.yaml`:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: rhdh-secrets
type: Opaque
stringData:
  # Add secrets with environment variable placeholders
  GITHUB_TOKEN: $GITHUB_TOKEN
```

::: tip Skip dynamic-plugins.yaml
If your workspace has a `metadata/` directory with Package CRD files, you can skip creating `dynamic-plugins.yaml`. The package will automatically generate configuration from metadata files.

For PR builds in CI (when `GIT_PR_NUMBER` is set), the package also automatically replaces local plugin paths with OCI URLs pointing to the PR's built artifacts.

See [Plugin Metadata Injection](/guide/configuration/config-files#plugin-metadata-injection) for details.
:::

## Step 4: Create Environment File

Create `.env`:

```bash
RHDH_VERSION="1.5"
INSTALLATION_METHOD="helm"
# Set to true if you don't need Keycloak auth
SKIP_KEYCLOAK_DEPLOYMENT=false
```

## Step 5: Create Your First Test

Create `tests/specs/my-plugin.spec.ts`:

```typescript
import { test, expect } from "rhdh-e2e-test-utils/test";

test.describe("My Plugin Tests", () => {
  test.beforeAll(async ({ rhdh }) => {
    // Configure RHDH with Keycloak authentication
    await rhdh.configure({ auth: "keycloak" });

    // Deploy RHDH instance
    await rhdh.deploy();
  });

  test.beforeEach(async ({ loginHelper }) => {
    // Login before each test
    await loginHelper.loginAsKeycloakUser();
  });

  test("should display plugin page", async ({ page, uiHelper }) => {
    // Navigate to your plugin
    await uiHelper.openSidebar("My Plugin");

    // Verify the page loaded
    await uiHelper.verifyHeading("My Plugin");

    // Add more assertions as needed
    await expect(page.locator("text=Welcome")).toBeVisible();
  });

  test("should interact with plugin features", async ({ page, uiHelper }) => {
    await uiHelper.openSidebar("My Plugin");

    // Click a button
    await uiHelper.clickButton("Get Started");

    // Verify result
    await uiHelper.verifyText("Feature enabled");
  });
});
```

## Step 6: Login to OpenShift

Ensure you're logged into your OpenShift cluster:

```bash
oc login --server=https://api.your-cluster.com:6443 --token=your-token
```

## Step 7: Run Tests

```bash
yarn playwright test
```

Or with UI mode:

```bash
yarn playwright test --ui
```

## What Happens When Tests Run

1. **Global Setup** runs first:
   - Validates required binaries (`oc`, `kubectl`, `helm`)
   - Fetches OpenShift cluster ingress domain
   - Deploys Keycloak (unless `SKIP_KEYCLOAK_DEPLOYMENT=true`)

2. **Before All** runs per worker:
   - Creates Kubernetes namespace (derived from project name)
   - Configures RHDH with your settings
   - Deploys RHDH instance

3. **Before Each** runs per test:
   - Logs in with the specified authentication method

4. **Tests** run:
   - Each test gets a fresh page but shares the RHDH deployment

5. **Cleanup** (in CI):
   - Namespaces are automatically deleted

## Using Guest Authentication

For simpler tests without Keycloak:

```typescript
test.beforeAll(async ({ rhdh }) => {
  await rhdh.configure({ auth: "guest" });
  await rhdh.deploy();
});

test.beforeEach(async ({ loginHelper }) => {
  await loginHelper.loginAsGuest();
});
```

Set `SKIP_KEYCLOAK_DEPLOYMENT=true` in your `.env` file.

## Next Steps

- [Core Concepts](/guide/core-concepts/) - Understand fixtures and deployment
- [Helpers](/guide/helpers/) - Learn about UIhelper, LoginHelper, APIHelper
- [Examples](/examples/) - See more complete examples
