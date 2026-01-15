# Your First Test

Create your first E2E test for RHDH using `rhdh-e2e-test-utils`.

::: tip Quick Start Available
For a faster setup, see the [Quick Start Guide](/guide/quick-start.md). This tutorial provides more detailed explanations for each step.
:::

## Prerequisites

- Node.js >= 22
- Yarn >= 3
- OpenShift cluster access
- `oc`, `kubectl`, `helm` installed

## Step 1: Create Project

```bash
mkdir my-plugin-e2e
cd my-plugin-e2e
yarn init -y
```

## Step 2: Install Dependencies

```bash
yarn add @playwright/test rhdh-e2e-test-utils typescript dotenv
```

## Step 3: Create Configuration Files

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

**tsconfig.json:**
```json
{
  "extends": "rhdh-e2e-test-utils/tsconfig",
  "include": ["tests/**/*.ts", "playwright.config.ts"]
}
```

**.env:**
```bash
RHDH_VERSION="1.5"
INSTALLATION_METHOD="helm"
SKIP_KEYCLOAK_DEPLOYMENT=true
```

## Step 4: Create Test Directory

```bash
mkdir -p tests/config tests/specs
```

## Step 5: Create Config Files

**tests/config/app-config-rhdh.yaml:**
```yaml
app:
  title: My First Test Instance
```

**tests/config/dynamic-plugins.yaml:**
```yaml
includes:
  - dynamic-plugins.default.yaml
```

**tests/config/rhdh-secrets.yaml:**
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: rhdh-secrets
type: Opaque
stringData: {}
```

## Step 6: Write Your Test

**tests/specs/first-test.spec.ts:**
```typescript
import { test, expect } from "rhdh-e2e-test-utils/test";

test.describe("My First Test Suite", () => {
  test.beforeAll(async ({ rhdh }) => {
    // Use guest auth for simplicity
    await rhdh.configure({ auth: "guest" });
    await rhdh.deploy();
  });

  test.beforeEach(async ({ page, loginHelper }) => {
    await page.goto("/");
    await loginHelper.loginAsGuest();
  });

  test("should display RHDH home page", async ({ uiHelper }) => {
    await uiHelper.verifyHeading(/Red Hat Developer Hub|RHDH/);
  });

  test("should navigate to catalog", async ({ page, uiHelper }) => {
    await uiHelper.openSidebar("Catalog");
    await expect(page).toHaveURL(/.*catalog/);
    await uiHelper.verifyHeading("Catalog");
  });
});
```

## Step 7: Login to OpenShift

```bash
oc login --server=https://api.your-cluster.com:6443 --token=your-token
```

## Step 8: Run Tests

```bash
yarn playwright test
```

## What Happens

1. **Global Setup** validates binaries and cluster
2. **beforeAll** creates namespace and deploys RHDH
3. **beforeEach** navigates and logs in
4. **Tests** run with assertions
5. **Cleanup** deletes namespace (in CI)

## Debugging

### View in Browser

```bash
yarn playwright test --headed
```

### Debug Mode

```bash
yarn playwright test --debug
```

### View Report

```bash
yarn playwright show-report
```

## Next Steps

- [Testing a Plugin](/tutorials/plugin-testing) - Complete workflow
- [Keycloak OIDC Testing](/tutorials/keycloak-oidc-testing) - Real auth
