import { test, expect } from "rhdh-e2e-test-utils/test";

test.describe("RHDH Basic Tests", () => {
  test("should load the home page", async ({ uiHelper }) => {
    await uiHelper.openSidebar("Home");
    await uiHelper.verifyHeading("Welcome to Red Hat Developer Hub");
  });

  test("should navigate to catalog", async ({ uiHelper }) => {
    await uiHelper.openSidebar("Catalog");
    await uiHelper.verifyHeading("My Org Catalog");
  });
});
