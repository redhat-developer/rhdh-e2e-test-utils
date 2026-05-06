import { RHDHDeployment } from "../../deployment/rhdh/index.js";
import { test as base } from "@playwright/test";
import { LoginHelper, UIhelper } from "../helpers/index.js";
import { runOnce } from "../run-once.js";
import { $ } from "../../utils/bash.js";
import { WorkspacePaths } from "../../utils/workspace-paths.js";
import path from "path";

type RHDHDeploymentTestFixtures = {
  rhdh: RHDHDeployment;
  uiHelper: UIhelper;
  loginHelper: LoginHelper;
  autoAnnotations: void;
};

type RHDHDeploymentWorkerFixtures = {
  rhdhDeploymentWorker: RHDHDeployment;
};

const baseTest = base.extend<
  RHDHDeploymentTestFixtures,
  RHDHDeploymentWorkerFixtures
>({
  rhdhDeploymentWorker: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use, workerInfo) => {
      // Set CWD to the workspace's e2e-tests directory so that relative
      // config paths resolve correctly even when Playwright runs from the repo root.
      // Each worker is a separate process, so this doesn't affect other workers.
      const e2eRoot = path.resolve(workerInfo.project.testDir, "..");
      process.chdir(e2eRoot);
      $.cwd = e2eRoot;

      const rhdhDeployment = new RHDHDeployment(workerInfo.project.name);

      await rhdhDeployment.configure();
      await use(rhdhDeployment);
    },
    { scope: "worker", auto: true },
  ],

  rhdh: [
    async ({ rhdhDeploymentWorker }, use) => {
      await use(rhdhDeploymentWorker);
    },
    { auto: true, scope: "test" },
  ],
  uiHelper: [
    async ({ page }, use) => {
      await use(new UIhelper(page));
    },
    { scope: "test" },
  ],
  loginHelper: [
    async ({ page }, use) => {
      await use(new LoginHelper(page));
    },
    { scope: "test" },
  ],
  baseURL: [
    async ({ rhdhDeploymentWorker }, use) => {
      await use(rhdhDeploymentWorker.rhdhUrl);
    },
    { scope: "test" },
  ] as const,
  autoAnnotations: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use, testInfo) => {
      testInfo.annotations.push(
        {
          type: "workspace",
          description: path.basename(WorkspacePaths.workspaceRoot),
        },
        { type: "project", description: testInfo.project.name },
      );
      await use();
    },
    { auto: true, scope: "test" },
  ],
});

export const test = Object.assign(baseTest, {
  runOnce,
});

export * from "@playwright/test";
