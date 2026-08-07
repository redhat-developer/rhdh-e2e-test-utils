import { RHDHDeployment } from "../../deployment/rhdh/index.js";
import { test as base, type TestInfo } from "@playwright/test";
import { LoginHelper, UIhelper } from "../helpers/index.js";
import { runOnce } from "../run-once.js";
import { $ } from "../../utils/bash.js";
import { WorkspacePaths } from "../../utils/workspace-paths.js";
import { collectAndWriteCoverage } from "../coverage.js";
import { isCoverageEnabled } from "../../utils/common.js";
import path from "path";

// Asking for coverage and getting none used to look exactly like success: the
// collector returned quietly and the run stayed green while every JSON was
// lost. Reporting it is deliberately two-channel — an annotation lands in the
// HTML report beside the result, the way `autoAnnotations` below does, and a
// console line keeps it in the CI log, where a green run is still read.
//
// Deduplicated by message rather than by a single flag: one recurring
// "no coverage found" must not be what silences the first real exception.
const loggedCoverageProblems = new Set<string>();
function reportCoverageProblem(testInfo: TestInfo, detail: string): void {
  testInfo.annotations.push({ type: "coverage", description: detail });
  if (loggedCoverageProblems.has(detail)) return;
  loggedCoverageProblems.add(detail);
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
    // Reads through `browser` so a context the spec opened itself is seen too,
    // but must also depend on `context`. Playwright sets auto fixtures up
    // before the ones a test asks for and tears them down in reverse, so
    // depending on `browser` alone puts this after the context fixture has
    // already closed — `browser.contexts()` comes back empty and every spec
    // driving the plain `page` fixture reports nothing. Naming `context` makes
    // this a dependent of it, which is what orders teardown correctly. It is
    // still lighter than depending on `page`: a context is created, not a page.
    async ({ browser, context }, use, testInfo) => {
      void context; // Depended on for teardown ordering, not for its value.
      await use();
      if (!isCoverageEnabled()) return;

      await collectAndWriteCoverage(
        browser,
        {
          dir: path.join(testInfo.project.outputDir, "coverage"),
          // Unique per worker process, so two workers writing the same
          // project's outputDir cannot land on the same filename.
          runId: `w${testInfo.workerIndex}`,
        },
        (detail) => reportCoverageProblem(testInfo, detail),
      );
    },
    { auto: true, scope: "test" },
  ],
});

export const test = Object.assign(baseTest, {
  runOnce,
});

export * from "@playwright/test";
