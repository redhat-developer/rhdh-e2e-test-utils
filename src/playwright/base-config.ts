import {
  defineConfig as baseDefineConfig,
  PlaywrightTestConfig,
} from "@playwright/test";
import { resolve } from "path";

/**
 * Base Playwright configuration that can be extended by workspace-specific configs.
 * Provides sensible defaults for RHDH plugin e2e testing.
 */
export const baseConfig: PlaywrightTestConfig = {
  testDir: "./tests",
  forbidOnly: !!process.env.CI,
  retries: Number(process.env.PLAYWRIGHT_RETRIES ?? 0),
  workers: process.env.PLAYWRIGHT_WORKERS || "50%",
  outputDir: "node_modules/.cache/e2e-test-results",
  timeout: 90_000,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "on-failure" }],
    ["json", { outputFile: "playwright-report/results.json" }],
    ["junit", { outputFile: "playwright-report/junit-results.xml" }],
    [resolve(import.meta.dirname, "../playwright/teardown-reporter.js")],
  ],
  use: {
    ignoreHTTPSErrors: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    viewport: { width: 1920, height: 1080 },
    video: {
      mode: "retain-on-failure",
      size: { width: 1280, height: 720 },
    },
    actionTimeout: 10_000,
    navigationTimeout: 50_000,
  },
  expect: {
    timeout: 10_000,
  },
  globalSetup: resolve(import.meta.dirname, "../playwright/global-setup.js"),
};

/**
 * Defines a workspace-specific config by merging with base config.
 * Only allows overriding the projects configuration.
 * @param overrides - Object containing projects to override
 * @returns Merged Playwright configuration
 */

export function defineConfig(
  overrides: Pick<PlaywrightTestConfig, "projects"> = {},
): PlaywrightTestConfig {
  return baseDefineConfig({
    ...baseConfig,
    projects: overrides.projects,
  });
}
