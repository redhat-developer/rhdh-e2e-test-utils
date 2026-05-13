export const workflowsTable = (page) => page.locator("#root div").filter({ hasText: "Workflows" }).nth(2);
