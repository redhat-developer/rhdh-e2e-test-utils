import path from "path";
import { test } from "@playwright/test";

/**
 * Static utility for resolving paths relative to a workspace's e2e-tests directory.
 * Uses `test.info().project.testDir` to determine the workspace location —
 * works correctly whether Playwright runs from the workspace or from the repo root.
 *
 * @example
 * ```typescript
 * import { WorkspacePaths } from '@red-hat-developer-hub/e2e-test-utils/utils';
 *
 * // One-liner to resolve a config file path
 * const configPath = WorkspacePaths.resolve("tests/config/rbac-configmap.yaml");
 *
 * // Access well-known directories
 * WorkspacePaths.e2eRoot;       // /abs/path/workspaces/acr/e2e-tests
 * WorkspacePaths.workspaceRoot; // /abs/path/workspaces/acr
 * WorkspacePaths.metadataDir;   // /abs/path/workspaces/acr/metadata
 * WorkspacePaths.configDir;     // /abs/path/workspaces/acr/e2e-tests/tests/config
 * ```
 */
export class WorkspacePaths {
  private constructor() {} // Static-only class

  /** The workspace's e2e-tests directory, derived from the current test's project testDir. */
  static get e2eRoot(): string {
    return path.resolve(test.info().project.testDir, "..");
  }

  /** Resolve a relative path from the e2e-tests directory. */
  static resolve(relativePath: string): string {
    return path.resolve(this.e2eRoot, relativePath);
  }

  /** The workspace root directory (parent of e2e-tests). */
  static get workspaceRoot(): string {
    return path.resolve(this.e2eRoot, "..");
  }

  /** The metadata directory. e.g., `workspaces/acr/metadata` */
  static get metadataDir(): string {
    return path.resolve(this.e2eRoot, "../metadata");
  }

  /** The tests/config directory. e.g., `workspaces/acr/e2e-tests/tests/config` */
  static get configDir(): string {
    return path.resolve(this.e2eRoot, "tests/config");
  }

  // ── Default config file paths ────────────────────────────────────────────

  /** Default app-config path: `tests/config/app-config-rhdh.yaml` */
  static get appConfig(): string {
    return path.resolve(this.e2eRoot, "tests/config/app-config-rhdh.yaml");
  }

  /** Default secrets path: `tests/config/rhdh-secrets.yaml` */
  static get secrets(): string {
    return path.resolve(this.e2eRoot, "tests/config/rhdh-secrets.yaml");
  }

  /** Default dynamic plugins path: `tests/config/dynamic-plugins.yaml` */
  static get dynamicPlugins(): string {
    return path.resolve(this.e2eRoot, "tests/config/dynamic-plugins.yaml");
  }

  /** Default Helm value file path: `tests/config/value_file.yaml` */
  static get valueFile(): string {
    return path.resolve(this.e2eRoot, "tests/config/value_file.yaml");
  }

  /** Optional Helm values merged after `value_file.yaml` when the new frontend system is active (explicit option, namespace suffix `-app-next`, or `USE_NEW_FRONTEND_SYSTEM=true`) and this file exists. */
  static get valueFileAppNext(): string {
    return path.resolve(this.e2eRoot, "tests/config/value_file-app-next.yaml");
  }

  /** Default operator subscription path: `tests/config/subscription.yaml` */
  static get subscription(): string {
    return path.resolve(this.e2eRoot, "tests/config/subscription.yaml");
  }
}
