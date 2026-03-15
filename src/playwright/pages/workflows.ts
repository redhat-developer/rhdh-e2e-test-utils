import type { Page } from "@playwright/test";

export const workflowsTable = (page: Page) =>
  page.locator("#root div").filter({ hasText: "Workflows" }).nth(2);
