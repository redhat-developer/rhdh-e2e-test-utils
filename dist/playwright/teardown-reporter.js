import path from "path";
import { KubernetesClientHelper } from "../utils/kubernetes-client.js";
import { getTeardownNamespaces } from "./teardown-namespaces.js";
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
export default class TeardownReporter {
    _projectTestCounts = new Map();
    _projectCompleted = new Map();
    _projectsWithFailures = new Set();
    _pendingDeletions = new Map();
    onBegin(_config, suite) {
        for (const test of suite.allTests()) {
            const name = test.parent.project()?.name;
            if (name) {
                this._projectTestCounts.set(name, (this._projectTestCounts.get(name) ?? 0) + 1);
                this._projectCompleted.set(name, 0);
            }
        }
    }
    onTestEnd(test, result) {
        const project = test.parent.project();
        if (!project)
            return;
        const isDone = result.status === "passed" ||
            result.status === "skipped" ||
            result.retry >= project.retries;
        if (!isDone)
            return;
        const name = project.name;
        if (result.status !== "passed" && result.status !== "skipped") {
            this._projectsWithFailures.add(name);
        }
        const completed = (this._projectCompleted.get(name) ?? 0) + 1;
        this._projectCompleted.set(name, completed);
        // Start cleanup immediately (fire-and-forget here, awaited in onEnd)
        if (completed === this._projectTestCounts.get(name) &&
            !this._pendingDeletions.has(name)) {
            this._pendingDeletions.set(name, this._deleteProjectNamespaces(name));
        }
    }
    async onEnd() {
        // Await all in-flight cleanups started from onTestEnd
        await Promise.all(this._pendingDeletions.values());
        // Fallback: clean up projects that didn't complete naturally
        // (e.g., interrupted run, maxFailures hit) — always collect diagnostics
        for (const [project] of this._projectTestCounts) {
            if (!this._pendingDeletions.has(project)) {
                this._projectsWithFailures.add(project);
                await this._deleteProjectNamespaces(project);
            }
        }
    }
    async _deleteProjectNamespaces(projectName) {
        let k8sClient;
        try {
            k8sClient = new KubernetesClientHelper();
        }
        catch (error) {
            console.error(`[TeardownReporter] Cannot connect to cluster, skipping cleanup:`, error);
            return;
        }
        const customNamespaces = getTeardownNamespaces(projectName);
        const namespaces = customNamespaces.length > 0 ? customNamespaces : [projectName];
        // Collect diagnostic logs on failure (always, regardless of CI)
        if (this._projectsWithFailures.has(projectName)) {
            for (const ns of namespaces) {
                const outputDir = path.join("node_modules", ".cache", "e2e-test-results", "logs", projectName);
                await k8sClient.collectDiagnosticLogs(ns, outputDir);
            }
        }
        // Retry + catch to avoid crashing Playwright if the cluster becomes unreachable.
        const maxAttempts = 2;
        if (process.env.CI === "true") {
            for (const ns of namespaces) {
                console.log(`[TeardownReporter] Deleting namespace "${ns}" (project: ${projectName})`);
                for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                    try {
                        await k8sClient.deleteNamespace(ns);
                        break;
                    }
                    catch (error) {
                        console.error(`[TeardownReporter] Failed to delete namespace "${ns}" (attempt ${attempt}/${maxAttempts}):`, error);
                        if (attempt < maxAttempts)
                            await new Promise((r) => setTimeout(r, 5000));
                    }
                }
            }
        }
    }
}
