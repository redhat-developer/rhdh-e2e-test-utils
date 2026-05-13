import type { Reporter, Suite, TestCase, TestResult } from "@playwright/test/reporter";
/**
 * Playwright reporter that deletes namespaces per-project as soon as all tests
 * in that project finish. This frees cluster resources early instead of waiting
 * for the entire suite to complete.
 *
 * Handles retries: a test is only counted as done when it passes/is skipped,
 * or exhausts all retry attempts.
 *
 * Falls back in onEnd() to clean up any projects that didn't complete naturally
 * (e.g., interrupted runs, maxFailures).
 *
 * Diagnostic log collection runs always (CI and local).
 * Namespace deletion only runs when process.env.CI === "true".
 *
 * By default, deletes the namespace matching the project name.
 * For custom namespaces, consumers can register them via registerTeardownNamespace().
 */
export default class TeardownReporter implements Reporter {
    private _projectTestCounts;
    private _projectCompleted;
    private _projectsWithFailures;
    private _pendingDeletions;
    onBegin(_config: unknown, suite: Suite): void;
    onTestEnd(test: TestCase, result: TestResult): void;
    onEnd(): Promise<void>;
    private _deleteProjectNamespaces;
}
//# sourceMappingURL=teardown-reporter.d.ts.map