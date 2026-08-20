import fs from "fs";
import path from "path";
import os from "os";
import lockfile from "proper-lockfile";
import { test } from "@playwright/test";

// Each test run gets its own flag directory (ppid = Playwright runner PID)
const flagDir = path.join(os.tmpdir(), `playwright-once-${process.ppid}`);

/**
 * How widely a `runOnce` key applies.
 *
 * - `"run"` — once per test run, across every project and worker. Right for setup
 *   that is genuinely shared, e.g. installing an operator into a fixed namespace
 *   that all projects then use.
 * - `"project"` — once per Playwright project. Right for anything that touches the
 *   project's own namespace or deployment, because a Playwright project is a
 *   namespace and each one needs its own.
 */
export type RunOnceScope = "run" | "project";

export type RunOnceOptions = {
  /** Defaults to `"run"`, which is how `runOnce` has always behaved. */
  scope?: RunOnceScope;
  /**
   * Project the call belongs to. Defaults to the Playwright project the calling
   * test is in. Only read when `scope` is `"project"`; pass it explicitly when
   * there is no Playwright context (tests of this helper, for instance).
   */
  project?: string;
};

/** Filenames come from project names, which may contain path separators. */
function slug(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/**
 * The Playwright project the caller is in, or undefined outside a test context.
 *
 * `test.info()` throws rather than returning undefined when there is no active
 * test, and this module is also imported by unit tests, so the throw is expected
 * and swallowed.
 */
function currentProject(): string | undefined {
  try {
    return test.info().project.name;
  } catch {
    return undefined;
  }
}

/**
 * Executes a function only once, even across multiple workers.
 * Automatically resets between test runs (each run uses a unique flag directory).
 * Safe for fullyParallel: true (uses proper-lockfile for cross-process coordination).
 *
 * The default scope is the whole run. When one spec is matched by more than one
 * project — which is what adding an `-app-next` lane does — a run-scoped key means
 * the first project's setup satisfies the second, and the second skips its own.
 * That is silent and, for anything deployment-related, fatal: pass
 * `{ scope: "project" }` for setup that belongs to a single project. When a
 * run-scoped key is skipped because a *different* project already ran it, this
 * logs a warning, because that is nearly always the mistake rather than the intent.
 *
 * @param key - Identifier for this setup operation
 * @param fn - Function to execute once
 * @param options - See {@link RunOnceOptions}
 * @returns true if executed, false if skipped (already ran)
 */
export async function runOnce(
  key: string,
  fn: () => Promise<void> | void,
  options: RunOnceOptions = {},
): Promise<boolean> {
  const scope = options.scope ?? "run";
  const project = options.project ?? currentProject();
  const scopedKey =
    scope === "project" && project ? `${key}--${slug(project)}` : key;

  const flagFile = path.join(flagDir, `${scopedKey}.done`);
  const lockTarget = path.join(flagDir, scopedKey);

  fs.mkdirSync(flagDir, { recursive: true });

  // already executed, skip without locking
  if (fs.existsSync(flagFile)) {
    warnIfAnotherProjectRanIt(flagFile, scope, project, key);
    return false;
  }

  // Ensure lock target file exists
  fs.writeFileSync(lockTarget, "", { flag: "a" });

  const release = await lockfile.lock(lockTarget, {
    retries: { retries: 30, minTimeout: 200 },
    stale: 300_000,
  });

  try {
    // Double-check after acquiring lock
    if (fs.existsSync(flagFile)) {
      warnIfAnotherProjectRanIt(flagFile, scope, project, key);
      return false;
    }
    await fn();
    // Recorded so a later skip can say which project satisfied the key.
    fs.writeFileSync(flagFile, project ?? "");
    return true;
  } finally {
    await release();
  }
}

/**
 * A run-scoped key skipped on behalf of a different project is the shape of the
 * bug this option exists for, so say so rather than skipping quietly.
 */
function warnIfAnotherProjectRanIt(
  flagFile: string,
  scope: RunOnceScope,
  project: string | undefined,
  key: string,
): void {
  if (scope !== "run" || !project) return;
  let ranBy: string;
  try {
    ranBy = fs.readFileSync(flagFile, "utf-8").trim();
  } catch {
    return;
  }
  if (!ranBy || ranBy === project) return;
  console.warn(
    `[runOnce] "${key}" was already run by project "${ranBy}", so project ` +
      `"${project}" is skipping it. If this setup belongs to a single project ` +
      `(a deployment, a namespace), pass { scope: "project" } — otherwise this ` +
      `project silently gets no setup.`,
  );
}
