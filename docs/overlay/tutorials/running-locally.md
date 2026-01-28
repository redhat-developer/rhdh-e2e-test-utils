# Running Tests Locally

::: tip Overlay Documentation
This page covers writing tests within rhdh-plugin-export-overlays.
For using rhdh-e2e-test-utils in external projects, see the [Guide](/guide/).
:::

This tutorial covers the local development workflow for overlay E2E tests.

## Prerequisites

Before running tests locally, ensure you have:

- Node.js 22+ installed
- Yarn 3+ installed
- Access to an OpenShift cluster
- CLI tools: `oc`, `kubectl`, `helm`
- Logged into the cluster: `oc login <cluster-url>`

## Setup

### 1. Navigate to Test Directory

```bash
cd workspaces/<plugin>/e2e-tests
```

### 2. Install Dependencies

```bash
yarn install
```

### 3. Install Playwright Browsers

```bash
npx playwright install
```

## Running Tests

### Run All Tests

```bash
yarn test
```

### Run in Headed Mode

See the browser while tests run:

```bash
yarn test:headed
```

### Run with Playwright UI

Interactive test runner:

```bash
yarn test:ui
```

### Run Specific Test File

```bash
yarn test tests/specs/my-plugin.spec.ts
```

### Run Specific Test

```bash
yarn test -g "test name pattern"
```

## Viewing Results

### View HTML Report

After tests complete:

```bash
yarn report
```

### Report Location

Reports are saved to `playwright-report/`:
- `playwright-report/index.html` - HTML report
- Test artifacts (screenshots, videos, traces)

## Development Workflow

### 1. Write Test

Create or modify `tests/specs/<plugin>.spec.ts`:

```typescript
import { test, expect } from "rhdh-e2e-test-utils/test";

test.describe("Test <plugin>", () => {
  test.beforeAll(async ({ rhdh }) => {
    await rhdh.configure({ auth: "keycloak" });
    await rhdh.deploy();
  });

  test.beforeEach(async ({ loginHelper }) => {
    await loginHelper.loginAsKeycloakUser();
  });

  test("new test case", async ({ uiHelper }) => {
    // Your test code
  });
});
```

### 2. Run Test

```bash
yarn test:headed
```

### 3. Debug Failures

Use Playwright UI for debugging:

```bash
yarn test:ui
```

### 4. View Trace

For failed tests, traces are automatically captured:

```bash
npx playwright show-trace playwright-report/trace.zip
```

## Environment Variables

### Using .env File

Create `.env` for local configuration:

```bash
# .env
RHDH_VERSION=1.5
INSTALLATION_METHOD=helm
SKIP_KEYCLOAK_DEPLOYMENT=false
```

### Common Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `RHDH_VERSION` | RHDH version to deploy | Latest |
| `INSTALLATION_METHOD` | `helm` or `operator` | `helm` |
| `SKIP_KEYCLOAK_DEPLOYMENT` | Skip Keycloak deployment entirely (for guest auth) | `false` |

See [Environment Variables Reference](/overlay/reference/environment-variables) for all available variables.

## Skipping Keycloak Deployment

Use this when running tests with guest authentication (no Keycloak needed):

```bash
SKIP_KEYCLOAK_DEPLOYMENT=true yarn test
```

::: tip
You don't need this flag if Keycloak already exists in the cluster. By default, the test framework will detect and reuse an existing Keycloak instance.
:::

## Running Against Existing Cluster

If RHDH is already deployed and you want to test against it:

```typescript
test.beforeAll(async ({ rhdh }) => {
  // Skip deployment, just use existing instance
  // Set baseURL manually if needed
});

test.beforeEach(async ({ page }) => {
  await page.goto("https://existing-rhdh-url.com");
  // Login manually or use existing session
});
```

## Code Quality Checks

### Type Checking

```bash
yarn tsc --noEmit
```

### Linting

```bash
yarn lint:check
yarn lint:fix  # Auto-fix issues
```

### Formatting

```bash
yarn prettier:check
yarn prettier:fix  # Auto-format
```

### All Checks

```bash
yarn check
```

## Debugging Tips

### 1. Use Headed Mode

```bash
yarn test:headed
```

### 2. Slow Down Execution

Add slowMo to config:

```typescript
// playwright.config.ts
export default defineConfig({
  use: {
    launchOptions: {
      slowMo: 500, // 500ms delay between actions
    },
  },
});
```

### 3. Take Screenshots

```typescript
test("screenshot test", async ({ page }) => {
  await page.goto("/");
  await page.screenshot({ path: "debug.png" });
});
```

### 4. View Console Logs

```typescript
test("console test", async ({ page }) => {
  page.on("console", msg => console.log(msg.text()));
  await page.goto("/");
});
```

## Cleanup

### Auto-Cleanup in CI

::: tip Automatic Namespace Cleanup
In CI environments (when `CI=true`), namespaces are **automatically deleted** after tests complete. This prevents resource accumulation on shared clusters.

For local development, namespaces are **preserved** for debugging. You must clean them up manually.
:::

### Delete Test Namespace

After testing locally, clean up the namespace:

```bash
oc delete namespace <test-namespace>
```

The namespace name is derived from the project name in `playwright.config.ts`.

### Clean Up Playwright Artifacts

```bash
rm -rf playwright-report test-results
```

## Related Pages

- [CI/CD Pipeline](./ci-pipeline) - Automated testing
- [Troubleshooting](/overlay/reference/troubleshooting) - Common issues
- [Directory Layout](/overlay/test-structure/directory-layout) - File structure
