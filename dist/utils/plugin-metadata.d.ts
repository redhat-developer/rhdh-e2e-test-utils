export interface PluginMetadata {
    packagePath: string;
    pluginConfig: Record<string, unknown>;
    packageName: string;
    sourceFile: string;
}
export interface PluginEntry {
    package: string;
    disabled?: boolean;
    pluginConfig?: Record<string, unknown>;
    [key: string]: unknown;
}
export interface DynamicPluginsConfig {
    plugins?: PluginEntry[];
    includes?: string[];
    [key: string]: unknown;
}
/**
 * Detects if we're running in a nightly/periodic job context.
 * Controls the entire nightly vs PR routing in deployment:
 * - Nightly: uses metadata OCI refs (latest published versions), skips metadata injection
 * - PR/local: uses metadata + OCI URL replacement
 *
 * Returns true when:
 * - JOB_NAME contains "periodic-" (OpenShift CI nightly/periodic jobs), OR
 * - E2E_NIGHTLY_MODE is set (manual override for local testing)
 */
export declare function isNightlyJob(): boolean;
/**
 * Extracts the plugin name from a package path or OCI reference.
 * Strips the `-dynamic` suffix so local paths and OCI refs for the same
 * logical plugin produce the same key.
 *
 * Handles various formats:
 * - Local path: ./dynamic-plugins/dist/backstage-community-plugin-tech-radar-dynamic
 * - OCI with alias: oci://quay.io/rhdh/plugin@sha256:...!backstage-community-plugin-tech-radar
 * - OCI without alias: oci://quay.io/rhdh/backstage-community-plugin-tech-radar:tag
 */
export declare function extractPluginName(packageRef: string): string;
export declare const DEFAULT_METADATA_PATH = "../metadata";
export declare function getMetadataDirectory(metadataPath?: string): string | null;
export declare function parseMetadataFile(filePath: string): Promise<PluginMetadata>;
export declare function parseAllMetadataFiles(metadataDir: string): Promise<Map<string, PluginMetadata>>;
/**
 * Resolves plugin package references to their target OCI URLs where applicable.
 *
 * Resolution priority for each plugin:
 * 1. PR OCI URL — if GIT_PR_NUMBER set and a PR image was published for this plugin
 * 2. Metadata OCI ref — uses dynamicArtifact from metadata (latest published version)
 * 3. Unchanged — local paths, npm packages, or other formats kept as-is
 */
/**
 * Returns a stable merge key for a plugin entry so OCI and local path for the same
 * logical plugin match when merging dynamic-plugins configs. Strips a trailing
 * "-dynamic" so e.g. backstage-community-plugin-catalog-backend-module-keycloak-dynamic
 * and ...-keycloak (from OCI) map to the same key.
 */
export declare function getNormalizedPluginMergeKey(entry: {
    package?: string;
}): string;
/**
 * Generates dynamic-plugins configuration for wrapper plugins
 * that need to be disabled. Each plugin entry contains:
 *  - package: ./dynamic-plugins/dist/$plugin-name
 *  - disabled: true
 *
 * @param plugins list of wrapper plugin names
 * @returns Dynamic plugins configuration that disables listed wrapper plugins
 */
export declare function disablePluginWrappers(plugins: string[]): DynamicPluginsConfig;
/**
 * Auto-generates plugin entries from workspace metadata files.
 * Creates raw entries with local paths and disabled: false.
 * Does NOT include pluginConfig — that's handled by processPluginsForDeployment.
 *
 * @param metadataPath Optional custom path to metadata directory
 * @returns Plugin entries discovered from metadata
 */
export declare function generatePluginsFromMetadata(metadataPath?: string): Promise<DynamicPluginsConfig>;
/**
 * Processes a dynamic plugins configuration for deployment.
 * Single entry point for both PR and nightly flows.
 *
 * Operations (in order):
 * 1. Inject appConfigExamples from metadata (PR mode only, unless RHDH_SKIP_PLUGIN_METADATA_INJECTION is set)
 * 2. Resolve all packages to OCI references:
 *    - PR with GIT_PR_NUMBER: workspace plugins in PR build → pr_ tags, rest unchanged
 *    - PR without GIT_PR_NUMBER: OCI plugins with metadata → metadata refs, rest unchanged
 *    - Nightly: OCI plugins with metadata → metadata refs, rest unchanged
 *
 * @param config The merged dynamic plugins configuration
 * @param metadataPath Optional custom path to metadata directory
 * @returns Processed configuration ready for deployment
 */
export declare function processPluginsForDeployment(config: DynamicPluginsConfig, metadataPath?: string): Promise<DynamicPluginsConfig>;
//# sourceMappingURL=plugin-metadata.d.ts.map