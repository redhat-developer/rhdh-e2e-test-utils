import { RHDHDeployment } from "../../deployment/rhdh/index.js";
import { test as base, type TestInfo } from "@playwright/test";
import { LoginHelper, UIhelper } from "../helpers/index.js";
import { runOnce } from "../run-once.js";
import { $ } from "../../utils/bash.js";
import { WorkspacePaths } from "../../utils/workspace-paths.js";
import { collectCoverageFromBrowser } from "../coverage.js";
import fs from "node:fs";
import path from "path";

// Every reason collection can come back empty. Kept together because the
// message is the only diagnosis a reader gets, and an incomplete list sends
// them to the wrong place: `collectCoverageFromBrowser` also skips a page whose
// `evaluate` was rejected, which lands here rather than raising.
const NO_COVERAGE_FOUND =
  "E2E_COLLECT_COVERAGE=true but no open page exposed __coverage__. The " +
  "deployed bundle may not be instrumented, the spec may have closed its " +
  "pages before teardown, or evaluation may have been blocked in the page.";

// Asking for coverage and getting none used to look exactly like success: the
// collector returned quietly and the run stayed green while every JSON was
// lost. Reporting it is deliberately two-channel — an annotation lands in the
// HTML report beside the result, the way `autoAnnotations` below does, and one
// console line per worker keeps it in the CI log without burying test output.
let coverageProblemLogged = false;
function reportCoverageProblem(testInfo: TestInfo, detail: string): void {
  testInfo.annotations.push({ type: "coverage", description: detail });
  if (coverageProblemLogged) return;
  coverageProblemLogged = true;
  console.warn(`[coverage] ${detail}`);
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

      try {
        const collected = await collectCoverageFromBrowser(browser);
        if (collected.length === 0) {
          reportCoverageProblem(testInfo, NO_COVERAGE_FOUND);
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
      } catch (error) {
        // Never rethrow. This runs in teardown for every test, so an unwritable
        // outputDir or a browser that died mid-test would otherwise fail a test
        // that had already passed — coverage is diagnostics, not a verdict.
        reportCoverageProblem(testInfo, `collection failed: ${error}`);
      }
    },
    { auto: true, scope: "test" },
  ],
});

export const test = Object.assign(baseTest, {
  runOnce,
});

export * from "@playwright/test";
