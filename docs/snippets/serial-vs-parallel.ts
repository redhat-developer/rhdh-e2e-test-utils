// ============================================
// PARALLEL TESTS (Default - Recommended)
// ============================================
// Each test gets its own browser context
// Tests run independently and can run concurrently
// Best for: Independent tests, faster execution

import { test } from "rhdh-e2e-test-utils/test";

test.describe("Parallel Tests", () => {
  test.beforeEach(async ({ loginHelper }) => {
    // Each test logs in fresh - isolated but slower
    await loginHelper.loginAsGuest();
  });

  test("test A - runs independently", async ({ uiHelper }) => {
    await uiHelper.openSidebar("Catalog");
  });

  test("test B - runs independently", async ({ uiHelper }) => {
    await uiHelper.openSidebar("Home");
  });
});

// ============================================
// SERIAL TESTS (Shared browser session)
// ============================================
// All tests share the same browser context
// Tests run sequentially in order
// Best for: Workflow tests, resource efficiency

import { setupBrowser, UIhelper, LoginHelper } from "rhdh-e2e-test-utils/helpers";

test.describe.configure({ mode: "serial" });

test.describe("Serial Tests - Shared Session", () => {
  let uiHelper: UIhelper;
  let loginHelper: LoginHelper;

  test.beforeAll(async ({ browser }) => {
    const context = await setupBrowser(browser);
    const page = await context.newPage();
    uiHelper = new UIhelper(page);
    loginHelper = new LoginHelper(page, uiHelper);

    // Login once for all tests
    await loginHelper.loginAsGuest();
  });

  test("step 1: navigate to catalog", async () => {
    await uiHelper.openSidebar("Catalog");
  });

  test("step 2: select an entity", async () => {
    // Uses same session from step 1
    await uiHelper.clickByDataTestId("entity-row-0");
  });

  test("step 3: verify entity details", async () => {
    // Uses same session from steps 1-2
    await uiHelper.verifyHeading("Entity Details");
  });
});
