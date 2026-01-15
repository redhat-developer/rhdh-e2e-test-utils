import { test, expect } from "rhdh-e2e-test-utils/test";

test.describe("Keycloak Authentication Tests", () => {
  test.beforeEach(async ({ loginHelper }) => {
    // Login with default Keycloak user (test1/test1@123)
    await loginHelper.loginAsKeycloakUser();
  });

  test("should display authenticated user info", async ({ uiHelper }) => {
    await uiHelper.openSidebar("Settings");
    await uiHelper.verifyText("test1");
  });
});
