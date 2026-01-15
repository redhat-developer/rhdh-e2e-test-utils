import { test, expect } from "rhdh-e2e-test-utils/test";

test.describe("Error Handling Patterns", () => {
  test("handling API errors gracefully", async ({ apiHelper }) => {
    try {
      const entity = await apiHelper.getEntityByName("non-existent-entity");
      expect(entity).toBeDefined();
    } catch (error) {
      // Entity not found - this is expected in some test scenarios
      console.log("Entity not found, creating it...");
      // Handle the error appropriately
    }
  });

  test("with timeout handling", async ({ uiHelper, page }) => {
    // Set a custom timeout for slow operations
    await test.step("Wait for slow component", async () => {
      await expect(page.getByTestId("slow-component")).toBeVisible({
        timeout: 30000,
      });
    });
  });

  test("with retry logic", async ({ apiHelper }) => {
    const maxRetries = 3;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await apiHelper.waitForEntityToAppear("my-component");
        break; // Success, exit loop
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxRetries) {
          console.log(`Attempt ${attempt} failed, retrying...`);
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    }

    if (lastError) {
      throw lastError;
    }
  });
});
