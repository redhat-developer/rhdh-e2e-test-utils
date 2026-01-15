# Testing Patterns: Serial vs Parallel

This guide explains when and how to use serial vs parallel test execution patterns.

## Overview

| Pattern | Execution | Browser Context | Use Case |
|---------|-----------|-----------------|----------|
| **Parallel** (default) | Tests run concurrently | Each test gets fresh context | Independent tests |
| **Serial** | Tests run sequentially | Shared browser context | Workflow tests |

## Parallel Tests (Default)

By default, Playwright runs tests in parallel with isolated browser contexts.

### Characteristics

- **Isolation**: Each test gets a fresh browser context
- **Speed**: Tests run concurrently across workers
- **Independence**: Tests cannot affect each other
- **Login overhead**: Each test must login separately

### When to Use

- Tests that don't depend on each other
- Tests that modify shared state (to avoid conflicts)
- General functional tests
- Smoke tests

### Example

```typescript
import { test, expect } from "rhdh-e2e-test-utils/test";

// Each test runs independently with its own browser context
test.describe("Catalog Tests", () => {
  test.beforeEach(async ({ loginHelper }) => {
    // Each test logs in fresh
    await loginHelper.loginAsGuest();
  });

  test("can view catalog", async ({ uiHelper }) => {
    await uiHelper.openSidebar("Catalog");
    await uiHelper.verifyHeading("My Org Catalog");
  });

  test("can search catalog", async ({ uiHelper }) => {
    await uiHelper.openSidebar("Catalog");
    await uiHelper.searchInputPlaceholder("Filter", "component");
  });

  test("can filter by kind", async ({ uiHelper }) => {
    await uiHelper.openSidebar("Catalog");
    await uiHelper.selectMuiBox("Kind", "API");
  });
});
```

### Configuration

```typescript
// playwright.config.ts
import { defineConfig } from "@playwright/test";
import { baseConfig } from "rhdh-e2e-test-utils/playwright-config";

export default defineConfig({
  ...baseConfig,
  workers: 4, // Run 4 tests in parallel
  fullyParallel: true, // All tests in parallel
});
```

## Serial Tests (Shared Session)

Serial tests share a browser context and run in sequence.

### Characteristics

- **Shared state**: Tests share the same browser session
- **Order dependency**: Tests run in defined order
- **Efficiency**: Single login for all tests
- **Workflow testing**: Perfect for multi-step flows

### When to Use

- Testing multi-step workflows
- Tests that build on each other
- Resource-intensive operations (single login)
- State-dependent test sequences

### Example

```typescript
import { test } from "@playwright/test";
import { setupBrowser, UIhelper, LoginHelper } from "rhdh-e2e-test-utils/helpers";

// Configure as serial
test.describe.configure({ mode: "serial" });

test.describe("Entity Creation Workflow", () => {
  let uiHelper: UIhelper;
  let loginHelper: LoginHelper;

  test.beforeAll(async ({ browser }) => {
    // Setup shared browser context
    const context = await setupBrowser(browser);
    const page = await context.newPage();
    uiHelper = new UIhelper(page);
    loginHelper = new LoginHelper(page, uiHelper);

    // Single login for all tests
    await loginHelper.loginAsGuest();
  });

  test("step 1: navigate to create", async () => {
    await uiHelper.openSidebar("Create...");
    await uiHelper.verifyHeading("Create");
  });

  test("step 2: fill template form", async () => {
    // Uses same session from step 1
    await uiHelper.clickButton("Choose");
    await uiHelper.fillTextInputByLabel("Name", "my-new-component");
    await uiHelper.fillTextInputByLabel("Description", "A test component");
  });

  test("step 3: submit and verify", async () => {
    // Uses same session from steps 1-2
    await uiHelper.clickButton("Create");
    await uiHelper.verifyHeading("my-new-component");
  });

  test("step 4: verify in catalog", async () => {
    // Uses same session from previous steps
    await uiHelper.openSidebar("Catalog");
    await uiHelper.verifyRowsInTable(["my-new-component"]);
  });
});
```

### Key Differences from Parallel

| Aspect | Parallel | Serial |
|--------|----------|--------|
| `test.describe` | Normal | `test.describe.configure({ mode: "serial" })` |
| Fixtures | Use `{ uiHelper }` | Create manually with `new UIhelper(page)` |
| Browser setup | Automatic | Use `setupBrowser(browser)` |
| Login | Each `beforeEach` | Once in `beforeAll` |
| State between tests | Isolated | Shared |

## Hybrid Approach

You can mix parallel and serial within the same test file:

```typescript
import { test, expect } from "rhdh-e2e-test-utils/test";
import { setupBrowser, UIhelper, LoginHelper } from "rhdh-e2e-test-utils/helpers";

// Parallel tests (use fixtures)
test.describe("Parallel Catalog Tests", () => {
  test.beforeEach(async ({ loginHelper }) => {
    await loginHelper.loginAsGuest();
  });

  test("view catalog", async ({ uiHelper }) => {
    await uiHelper.openSidebar("Catalog");
  });

  test("view APIs", async ({ uiHelper }) => {
    await uiHelper.openSidebar("APIs");
  });
});

// Serial tests (shared session)
test.describe("Serial Workflow Tests", () => {
  test.describe.configure({ mode: "serial" });

  let uiHelper: UIhelper;
  let loginHelper: LoginHelper;

  test.beforeAll(async ({ browser }) => {
    const context = await setupBrowser(browser);
    const page = await context.newPage();
    uiHelper = new UIhelper(page);
    loginHelper = new LoginHelper(page, uiHelper);
    await loginHelper.loginAsGuest();
  });

  test("step 1", async () => { /* ... */ });
  test("step 2", async () => { /* ... */ });
});
```

## Best Practices

### For Parallel Tests

1. **Keep tests independent** - Each test should work in isolation
2. **Use unique data** - Generate unique names to avoid conflicts
3. **Clean up after** - Remove any created resources
4. **Don't rely on order** - Tests may run in any sequence

```typescript
test("create entity with unique name", async ({ apiHelper }) => {
  const uniqueName = `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  await apiHelper.importEntity(`https://example.com/${uniqueName}/catalog-info.yaml`);

  // Clean up
  test.afterEach(async () => {
    await apiHelper.deleteEntity(uniqueName);
  });
});
```

### For Serial Tests

1. **Use meaningful step names** - Makes failures easier to diagnose
2. **Handle cleanup properly** - Clean up in `afterAll`, not `afterEach`
3. **Consider failure impact** - Later tests may fail if early ones fail
4. **Minimize shared state** - Only share what's necessary

```typescript
test.describe("Workflow with proper cleanup", () => {
  test.describe.configure({ mode: "serial" });

  let createdEntity: string;

  test.afterAll(async ({ browser }) => {
    // Clean up after all tests complete (or fail)
    if (createdEntity) {
      // Cleanup logic here
    }
  });

  test("create entity", async () => {
    createdEntity = "my-entity";
    // ... creation logic
  });
});
```

## Performance Comparison

| Scenario | Parallel (4 workers) | Serial |
|----------|---------------------|--------|
| 10 independent tests | ~30 seconds | ~2 minutes |
| 5-step workflow | N/A (can't parallelize) | ~1 minute |
| 10 tests with shared login | ~30 sec + 10 logins | ~1 min + 1 login |

## Decision Flowchart

```
┌─────────────────────────────────────────┐
│ Do tests depend on each other's state?  │
└─────────────────────┬───────────────────┘
                      │
         ┌────────────┴────────────┐
         │                         │
        Yes                        No
         │                         │
         ▼                         ▼
┌─────────────────┐    ┌─────────────────────┐
│  Use Serial     │    │ Is login expensive? │
│  mode: "serial" │    └──────────┬──────────┘
└─────────────────┘               │
                      ┌───────────┴───────────┐
                      │                       │
                     Yes                      No
                      │                       │
                      ▼                       ▼
             ┌────────────────┐    ┌─────────────────┐
             │Consider Serial │    │  Use Parallel   │
             │for same user   │    │  (default)      │
             └────────────────┘    └─────────────────┘
```

## Related Pages

- [Error Handling](./error-handling.md) - Handle failures gracefully
- [Playwright Fixtures](./playwright-fixtures.md) - Understanding fixtures
- [Serial Tests Example](/examples/serial-tests.md) - Complete example
