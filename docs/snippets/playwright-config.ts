import { defineConfig } from "@playwright/test";
import { baseConfig } from "rhdh-e2e-test-utils/playwright-config";

export default defineConfig({
  ...baseConfig,
  testDir: "./tests",
  projects: [
    {
      name: "rhdh-e2e",
      use: { ...baseConfig.use },
    },
  ],
});
