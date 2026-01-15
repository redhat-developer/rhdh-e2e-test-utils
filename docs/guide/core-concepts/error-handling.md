# Error Handling Best Practices

This guide covers error handling patterns for robust E2E tests.

## Why Error Handling Matters

E2E tests interact with real systems that can fail. Proper error handling:
- Makes tests more reliable
- Provides better debugging information
- Enables graceful recovery from transient failures
- Improves test maintenance

## Common Error Scenarios

### 1. Element Not Found

```typescript
import { test, expect } from "rhdh-e2e-test-utils/test";

test("handle missing element gracefully", async ({ uiHelper, page }) => {
  // Bad: Will fail with generic timeout error
  // await uiHelper.verifyHeading("Non-existent Heading");

  // Good: Use explicit assertions with clear expectations
  await expect(page.getByRole("heading", { name: "My Heading" }))
    .toBeVisible({ timeout: 10000 });
});
```

### 2. API Errors

```typescript
test("handle API errors", async ({ apiHelper }) => {
  try {
    const entity = await apiHelper.getEntityByName("my-component");
    expect(entity).toBeDefined();
  } catch (error) {
    // Log for debugging
    console.error("Failed to fetch entity:", error);

    // Re-throw with context
    throw new Error(`Entity 'my-component' not found. Is it registered?`);
  }
});
```

### 3. Timeout Errors

```typescript
test("handle slow operations", async ({ page, uiHelper }) => {
  // Increase timeout for known slow operations
  await test.step("Wait for slow data load", async () => {
    await expect(page.getByTestId("data-table"))
      .toBeVisible({ timeout: 60000 });
  });

  // Or use polling for eventual consistency
  await expect(async () => {
    const count = await page.getByTestId("item").count();
    expect(count).toBeGreaterThan(0);
  }).toPass({ timeout: 30000 });
});
```

### 4. Network Errors

```typescript
test("handle network issues", async ({ page }) => {
  // Wait for specific API response
  const responsePromise = page.waitForResponse(
    response => response.url().includes("/api/catalog") && response.ok()
  );

  await page.click('button[data-testid="refresh"]');

  try {
    await responsePromise;
  } catch (error) {
    // Network request failed or timed out
    console.error("API call failed:", error);
    throw new Error("Catalog API is not responding");
  }
});
```

## Retry Patterns

### Simple Retry

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      console.log(`Attempt ${attempt}/${maxRetries} failed:`, error);

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

// Usage
test("retry flaky operation", async ({ apiHelper }) => {
  const entity = await withRetry(
    () => apiHelper.getEntityByName("my-component"),
    3,
    2000
  );
  expect(entity).toBeDefined();
});
```

### Playwright Built-in Retry

```typescript
test("use Playwright's toPass for polling", async ({ apiHelper }) => {
  // This will retry until the assertion passes or timeout
  await expect(async () => {
    const entity = await apiHelper.getEntityByName("my-component");
    expect(entity.status).toBe("active");
  }).toPass({
    timeout: 30000,
    intervals: [1000, 2000, 5000], // Backoff intervals
  });
});
```

## Test Cleanup

Always clean up resources, even if tests fail:

```typescript
test.describe("API operations with cleanup", () => {
  const createdEntities: string[] = [];

  test.afterEach(async ({ apiHelper }) => {
    // Clean up any entities created during the test
    for (const entityName of createdEntities) {
      try {
        await apiHelper.deleteEntity(entityName);
      } catch (error) {
        console.warn(`Failed to clean up ${entityName}:`, error);
        // Don't fail the test for cleanup errors
      }
    }
    createdEntities.length = 0; // Clear the array
  });

  test("create and verify entity", async ({ apiHelper }) => {
    const name = `test-entity-${Date.now()}`;
    createdEntities.push(name);

    await apiHelper.importEntity(`https://example.com/${name}/catalog-info.yaml`);

    await expect(async () => {
      const entity = await apiHelper.getEntityByName(name);
      expect(entity).toBeDefined();
    }).toPass({ timeout: 30000 });
  });
});
```

## Logging and Debugging

### Test Steps for Better Reporting

```typescript
test("complex workflow with steps", async ({ uiHelper, loginHelper }) => {
  await test.step("Login as admin", async () => {
    await loginHelper.loginAsKeycloakUser("admin", "admin123");
  });

  await test.step("Navigate to settings", async () => {
    await uiHelper.openSidebar("Settings");
  });

  await test.step("Update configuration", async () => {
    await uiHelper.clickButton("Edit");
    await uiHelper.fillTextInputByLabel("Name", "New Name");
    await uiHelper.clickButton("Save");
  });

  await test.step("Verify changes", async () => {
    await uiHelper.verifyText("New Name");
  });
});
```

### Screenshot on Failure

```typescript
// playwright.config.ts
import { defineConfig } from "@playwright/test";
import { baseConfig } from "rhdh-e2e-test-utils/playwright-config";

export default defineConfig({
  ...baseConfig,
  use: {
    ...baseConfig.use,
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "retain-on-failure",
  },
});
```

### Custom Error Messages

```typescript
test("verify component with context", async ({ uiHelper }) => {
  const componentName = "my-component";

  await uiHelper.openSidebar("Catalog");

  // Add context to assertions
  await expect(
    uiHelper.page.getByText(componentName),
    `Component "${componentName}" should be visible in catalog`
  ).toBeVisible();
});
```

## Common Pitfalls

### 1. Swallowing Errors

```typescript
// Bad: Errors are silently ignored
try {
  await apiHelper.deleteEntity("component");
} catch {
  // Nothing happens
}

// Good: Log the error or handle it appropriately
try {
  await apiHelper.deleteEntity("component");
} catch (error) {
  console.warn("Cleanup failed (may be expected):", error);
}
```

### 2. Race Conditions

```typescript
// Bad: Click without waiting for navigation
await page.click('a[href="/catalog"]');
await uiHelper.verifyHeading("Catalog"); // May fail

// Good: Wait for navigation
await Promise.all([
  page.waitForURL("**/catalog"),
  page.click('a[href="/catalog"]'),
]);
await uiHelper.verifyHeading("Catalog");
```

### 3. Hard-coded Waits

```typescript
// Bad: Fixed delay
await page.click('button[data-testid="save"]');
await page.waitForTimeout(3000);
await uiHelper.verifyText("Saved");

// Good: Wait for condition
await page.click('button[data-testid="save"]');
await expect(page.getByText("Saved")).toBeVisible();
```

## Error Handling Checklist

- [ ] Use specific error messages that include context
- [ ] Implement retry logic for flaky operations
- [ ] Always clean up resources in afterEach/afterAll
- [ ] Use test steps for better failure reporting
- [ ] Enable screenshots and traces for debugging
- [ ] Avoid hard-coded waits - use conditions instead
- [ ] Log errors before re-throwing for debugging
- [ ] Handle expected errors gracefully (e.g., "entity already exists")

## Related Pages

- [Serial vs Parallel Testing](./testing-patterns.md) - Test execution patterns
- [Architecture Overview](./architecture.md) - How components work together
- [APIHelper](/guide/helpers/api-helper.md) - API error handling
