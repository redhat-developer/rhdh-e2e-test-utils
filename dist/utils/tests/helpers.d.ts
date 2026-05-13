/** Saves and restores process.env around each test. */
export declare function withCleanEnv(): {
    save(): void;
    restore(): void;
};
/** Creates a temporary metadata directory with Package CRD YAML files. */
export declare function createMetadataFixture(plugins: Array<{
    name: string;
    packageName: string;
    dynamicArtifact: string;
    appConfigExamples?: Record<string, unknown>;
}>): Promise<string>;
/**
 * Creates a workspace-like directory structure with metadata, source.json,
 * and plugins-list.yaml. Used for tests that trigger PR OCI URL fetching.
 */
export declare function createWorkspaceFixture(plugins: Array<{
    name: string;
    packageName: string;
    dynamicArtifact: string;
    appConfigExamples?: Record<string, unknown>;
}>): Promise<{
    wsDir: string;
    metadataDir: string;
}>;
//# sourceMappingURL=helpers.d.ts.map