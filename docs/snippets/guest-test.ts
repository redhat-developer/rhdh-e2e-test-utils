import { test, expect } from "rhdh-e2e-test-utils/test";

test.describe("Guest Authentication Tests", () => {
  test.beforeEach(async ({ loginHelper }) => {
    await loginHelper.loginAsGuest();
  });

  test("should access catalog as guest", async ({ uiHelper }) => {
    await uiHelper.openSidebar("Catalog");
    await uiHelper.verifyHeading("My Org Catalog");
  });
});
