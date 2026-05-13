/**
 * Executes a function only once per test run, even across multiple workers.
 * Automatically resets between test runs (each run uses a unique flag directory).
 * Safe for fullyParallel: true (uses proper-lockfile for cross-process coordination).
 *
 * @param key - Unique identifier for this setup operation
 * @param fn - Function to execute once
 * @returns true if executed, false if skipped (already ran)
 */
export declare function runOnce(key: string, fn: () => Promise<void> | void): Promise<boolean>;
//# sourceMappingURL=run-once.d.ts.map