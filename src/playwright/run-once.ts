import fs from "fs";
import path from "path";
import os from "os";
import lockfile from "proper-lockfile";

// Each test run gets its own flag directory (ppid = Playwright runner PID)
const flagDir = path.join(os.tmpdir(), `playwright-once-${process.ppid}`);

/**
 * Executes a function only once per test run, even across multiple workers.
 * Automatically resets between test runs (each run uses a unique flag directory).
 * Safe for fullyParallel: true (uses proper-lockfile for cross-process coordination).
 *
 * @param key - Unique identifier for this setup operation
 * @param fn - Function to execute once
 * @returns true if executed, false if skipped (already ran)
 */
export async function runOnce(
  key: string,
  fn: () => Promise<void> | void,
): Promise<boolean> {
  const flagFile = path.join(flagDir, `${key}.done`);
  const lockTarget = path.join(flagDir, key);

  fs.mkdirSync(flagDir, { recursive: true });

  // already executed, skip without locking
  if (fs.existsSync(flagFile)) return false;

  // Ensure lock target file exists
  fs.writeFileSync(lockTarget, "", { flag: "a" });
  const release = await lockfile.lock(lockTarget, {
    retries: { retries: 30, minTimeout: 200 },
    stale: 300_000,
  });

  try {
    // Double-check after acquiring lock
    if (fs.existsSync(flagFile)) return false;
    await fn();
    fs.writeFileSync(flagFile, "");
    return true;
  } finally {
    await release();
  }
}
