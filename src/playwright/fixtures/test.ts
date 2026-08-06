import { RHDHDeployment } from "../../deployment/rhdh/index.js";
import { test as base } from "@playwright/test";
import { LoginHelper, UIhelper } from "../helpers/index.js";
import { runOnce } from "../run-once.js";
import { $ } from "../../utils/bash.js";
import { WorkspacePaths } from "../../utils/workspace-paths.js";
import { collectCoverageFromBrowser } from "../coverage.js";
import fs from "node:fs";
import path from "path";

// Asking for coverage and getting none is a failure, but it used to look
// exactly like success: the collector returned quietly and the run stayed
// green while every JSON was lost. Say it once per worker — enough to surface
// in CI logs, quiet enough not to bury the test output.
let noCoverageWarningIssued = false;
function warnNoCoverageFound(): void {
  if (noCoverageWarningIssued) return;
  noCoverageWarningIssued = true;
  console.warn(
    "[coverage] E2E_COLLECT_COVERAGE=true but no open page exposed " +
      "__coverage__. Either the deployed plugin bundle was not instrumented, " +
      "or the spec closed its pages before teardown.",
  );
}

type RHDHDeploymentTestFixtures = {
  rhdh: RHDHDeployment;
  uiHelper: UIhelper;
  loginHelper: LoginHelper;
  autoAnnotations: void;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  _coverageCollector: void;
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
  // eslint-disable-next-line @typescript-eslint/naming-convention
  _coverageCollector: [
    // Depends on `browser` rather than `page`: coverage can live in a context
    // the spec opened itself, and reading only the fixture page misses it.
    // This is also lighter than before — an auto fixture instantiates what it
    // depends on, so specs that never touch the fixture page no longer pay for
    // a blank one on every test.
    async ({ browser }, use, testInfo) => {
      await use();
      if (process.env.E2E_COLLECT_COVERAGE !== "true") return;

      const collected = await collectCoverageFromBrowser(browser);
      if (collected.length === 0) {
        warnNoCoverageFound();
        return;
      }
      const dir = path.join(testInfo.project.outputDir, "coverage");
      fs.mkdirSync(dir, { recursive: true });
      collected.forEach((coverage, index) => {
        // The index disambiguates pages collected within the same millisecond.
        fs.writeFileSync(
          path.join(dir, `${testInfo.testId}-${Date.now()}-${index}.json`),
          JSON.stringify(coverage),
        );
      });
    },
    { auto: true, scope: "test" },
  ],
});

export const test = Object.assign(baseTest, {
  runOnce,
});

export * from "@playwright/test";
