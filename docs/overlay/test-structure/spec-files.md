# Spec Files

::: tip Overlay Documentation
This page covers writing tests within rhdh-plugin-export-overlays.
For using rhdh-e2e-test-utils in external projects, see the [Guide](/guide/).
:::

This page explains how to write test specification files for overlay E2E tests.

## File Location

Spec files are placed in `tests/specs/`:

```
tests/specs/
├── <plugin>.spec.ts        # Main test file
├── feature-a.spec.ts       # Additional test files (optional)
└── deploy-*.sh             # Deployment scripts (optional)
```

## Basic Structure

A typical spec file follows this structure:

```typescript
import { test, expect, Page } from "rhdh-e2e-test-utils/test";

test.describe("Test <plugin>", () => {
  // Setup: Deploy RHDH once per worker
  test.beforeAll(async ({ rhdh }) => {
    await rhdh.configure({ auth: "keycloak" });
    await rhdh.deploy();
  });

  // Login before each test
  test.beforeEach(async ({ loginHelper }) => {
    await loginHelper.loginAsKeycloakUser();
  });

  // Test cases
  test("Verify functionality", async ({ page, uiHelper }) => {
    // Test implementation
  });
});
```

## Imports

Import test utilities from `rhdh-e2e-test-utils`:

```typescript
// Core test fixtures
import { test, expect, Page } from "rhdh-e2e-test-utils/test";

// Utility functions
import { $ } from "rhdh-e2e-test-utils/utils";

// Node.js modules
import path from "path";
```

## Available Fixtures

The following fixtures are automatically injected into tests:

| Fixture | Type | Scope | Description |
|---------|------|-------|-------------|
| `rhdh` | `RHDHDeployment` | Worker | RHDH deployment management |
| `uiHelper` | `UIhelper` | Test | UI interaction helper |
| `loginHelper` | `LoginHelper` | Test | Authentication helper |
| `page` | `Page` | Test | Playwright Page object |
| `baseURL` | `string` | Worker | RHDH instance URL |

## Setup Patterns

There are two main scenarios for test setup:

1. **Without pre-requisites**: Just configure plugin settings and deploy RHDH
2. **With pre-requisites**: Deploy external services first, then deploy RHDH

### Scenario 1: Without Pre-requisites

For plugins that only need configuration (no external services):

```typescript
test.beforeAll(async ({ rhdh }) => {
  await rhdh.configure({ auth: "keycloak" });
  await rhdh.deploy();
});
```

This is the simplest setup. RHDH is configured and deployed directly. Plugin configuration comes from `tests/config/app-config-rhdh.yaml`.

### Scenario 2: With Pre-requisites (External Services)

Some plugins require external services to be running before RHDH starts. For example, the Tech Radar plugin needs a data provider service.

**The order matters:**
1. Configure RHDH
2. Deploy external service(s)
3. Get service URL and set as environment variable
4. Deploy RHDH (uses the environment variable in its configuration)

```typescript
import { $ } from "rhdh-e2e-test-utils/utils";
import path from "path";

const setupScript = path.join(
  import.meta.dirname,
  "deploy-customization-provider.sh",
);

test.beforeAll(async ({ rhdh }) => {
  const project = rhdh.deploymentConfig.namespace;

  // 1. Configure RHDH first
  await rhdh.configure({ auth: "keycloak" });

  // 2. Deploy external service
  await $`bash ${setupScript} ${project}`;

  // 3. Get service URL and set as env var
  process.env.TECH_RADAR_DATA_URL = (
    await rhdh.k8sClient.getRouteLocation(
      project,
      "test-backstage-customization-provider",
    )
  ).replace("http://", "");

  // 4. Deploy RHDH (will use TECH_RADAR_DATA_URL from rhdh-secrets.yaml)
  await rhdh.deploy();
});
```

See [Tech Radar Example](/overlay/examples/tech-radar) for a complete implementation.

### Guest Auth Setup

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

## Login Patterns

### Keycloak Login

```typescript
test.beforeEach(async ({ loginHelper }) => {
  await loginHelper.loginAsKeycloakUser();
});
```

### Default Keycloak Users

The global setup creates these users automatically:

| Username | Password | Groups |
|----------|----------|--------|
| `test1` | `test1@123` | developers |
| `test2` | `test2@123` | developers |

### Custom Credentials

```typescript
test.beforeEach(async ({ loginHelper }) => {
  await loginHelper.loginAsKeycloakUser("user2", "password2");
});
```

### Guest Login

```typescript
test.beforeEach(async ({ loginHelper }) => {
  await loginHelper.loginAsGuest();
});
```

## Writing Tests

### UI Navigation

```typescript
test("Navigate to plugin", async ({ uiHelper }) => {
  await uiHelper.openSidebar("Tech Radar");
  await uiHelper.verifyHeading("Tech Radar");
});
```

### Verify Content

```typescript
test("Verify content exists", async ({ uiHelper }) => {
  await uiHelper.verifyText("Expected text");
  await uiHelper.verifyHeading("Expected heading");
});
```

### Custom Locators

```typescript
test("Verify specific element", async ({ page }) => {
  const element = page.locator('h2:has-text("Section")');
  await expect(element).toBeVisible();
});
```

### Helper Functions

Create reusable verification functions:

```typescript
async function verifyRadarDetails(page: Page, section: string, text: string) {
  const sectionLocator = page
    .locator(`h2:has-text("${section}")`)
    .locator("xpath=ancestor::*")
    .locator(`text=${text}`);
  await sectionLocator.scrollIntoViewIfNeeded();
  await expect(sectionLocator).toBeVisible();
}

test("Verify radar sections", async ({ page }) => {
  await verifyRadarDetails(page, "Languages", "JavaScript");
  await verifyRadarDetails(page, "Frameworks", "React");
});
```

## Real Example: Tech Radar

Complete spec file from the tech-radar workspace:

```typescript
import { test, expect, Page } from "rhdh-e2e-test-utils/test";
import { $ } from "rhdh-e2e-test-utils/utils";
import path from "path";

const setupScript = path.join(
  import.meta.dirname,
  "deploy-customization-provider.sh",
);

test.describe("Test tech-radar plugin", () => {
  test.beforeAll(async ({ rhdh }) => {
    const project = rhdh.deploymentConfig.namespace;
    await rhdh.configure({ auth: "keycloak" });
    await $`bash ${setupScript} ${project}`;
    process.env.TECH_RADAR_DATA_URL = (
      await rhdh.k8sClient.getRouteLocation(
        project,
        "test-backstage-customization-provider",
      )
    ).replace("http://", "");
    await rhdh.deploy();
  });

  test.beforeEach(async ({ loginHelper }) => {
    await loginHelper.loginAsKeycloakUser();
  });

  test("Verify tech-radar", async ({ page, uiHelper }) => {
    await uiHelper.openSidebar("Tech Radar");
    await uiHelper.verifyHeading("Tech Radar");
    await uiHelper.verifyHeading("Company Radar");

    await verifyRadarDetails(page, "Languages", "JavaScript");
    await verifyRadarDetails(page, "Frameworks", "React");
    await verifyRadarDetails(page, "Infrastructure", "GitHub Actions");
  });
});

async function verifyRadarDetails(page: Page, section: string, text: string) {
  const sectionLocator = page
    .locator(`h2:has-text("${section}")`)
    .locator("xpath=ancestor::*")
    .locator(`text=${text}`);
  await sectionLocator.scrollIntoViewIfNeeded();
  await expect(sectionLocator).toBeVisible();
}
```

## UIhelper Methods

Common methods from `UIhelper`:

| Method | Description |
|--------|-------------|
| `openSidebar(name)` | Click sidebar item |
| `verifyHeading(text)` | Verify H1-H6 heading |
| `verifyText(text)` | Verify text is visible |
| `clickButton(name)` | Click button by name |
| `clickLink(text)` | Click link by text |
| `waitForLoad()` | Wait for page load |

See [UIhelper API](/api/helpers/ui-helper) for full reference.

## Related Pages

- [Directory Layout](./directory-layout) - File placement
- [Configuration Files](./configuration-files) - YAML setup
- [Pre-requisite Services](/overlay/tutorials/custom-deployment) - Deploy dependencies before RHDH
- [UIhelper API](/api/helpers/ui-helper) - Full helper reference
