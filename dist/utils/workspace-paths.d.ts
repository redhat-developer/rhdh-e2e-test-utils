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
export declare class WorkspacePaths {
    private constructor();
    /** The workspace's e2e-tests directory, derived from the current test's project testDir. */
    static get e2eRoot(): string;
    /** Resolve a relative path from the e2e-tests directory. */
    static resolve(relativePath: string): string;
    /** The workspace root directory (parent of e2e-tests). */
    static get workspaceRoot(): string;
    /** The metadata directory. e.g., `workspaces/acr/metadata` */
    static get metadataDir(): string;
    /** The tests/config directory. e.g., `workspaces/acr/e2e-tests/tests/config` */
    static get configDir(): string;
    /** Default app-config path: `tests/config/app-config-rhdh.yaml` */
    static get appConfig(): string;
    /** Default secrets path: `tests/config/rhdh-secrets.yaml` */
    static get secrets(): string;
    /** Default dynamic plugins path: `tests/config/dynamic-plugins.yaml` */
    static get dynamicPlugins(): string;
    /** Default Helm value file path: `tests/config/value_file.yaml` */
    static get valueFile(): string;
    /** Default operator subscription path: `tests/config/subscription.yaml` */
    static get subscription(): string;
}
//# sourceMappingURL=workspace-paths.d.ts.map