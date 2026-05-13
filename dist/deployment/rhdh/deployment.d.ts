import { KubernetesClientHelper } from "../../utils/kubernetes-client.js";
import type { DeploymentOptions, DeploymentConfig } from "./types.js";
export declare class RHDHDeployment {
    k8sClient: KubernetesClientHelper;
    rhdhUrl: string;
    deploymentConfig: DeploymentConfig;
    constructor(namespace: string);
    deploy(options?: {
        timeout?: number | null;
    }): Promise<void>;
    private _applyAppConfig;
    private _applySecrets;
    /** Shared merge strategy for dynamic plugin arrays. */
    private static readonly pluginMergeOpts;
    /**
     * Merges package defaults + auth config (+ optional user config) into a
     * single dynamic plugins configuration.
     */
    private _mergeBaseConfigs;
    /**
     * Merges a generated plugin config with the base (defaults + auth) config.
     */
    private _mergeGeneratedWithBase;
    /**
     * Builds the merged dynamic plugins configuration.
     *
     * 1. Assembles raw config: user-provided OR auto-generated from metadata
     * 2. Processes for deployment: injects metadata (PR) + resolves all packages to OCI
     *
     * The processing step is shared — processPluginsForDeployment handles
     * both PR and nightly via isNightlyJob() and GIT_PR_NUMBER detection.
     */
    private _buildDynamicPluginsConfig;
    private _applyDynamicPlugins;
    private _deployWithHelm;
    private _deployWithOperator;
    rolloutRestart(): Promise<void>;
    /**
     * Performs a clean restart by scaling down to 0 first, waiting for pods to terminate,
     * then scaling back up. This prevents MigrationLocked errors by ensuring no pods
     * hold database locks when new pods start.
     */
    scaleDownAndRestart(): Promise<void>;
    waitUntilReady(timeout?: number): Promise<void>;
    teardown(): Promise<void>;
    private _deploymentExists;
    private _resolveChartVersion;
    /**
     * Resolve the semantic version from the "next" tag by looking up the
     * downstream image (rhdh-hub-rhel9) and finding tags with the same digest.
     */
    private _resolveVersionFromNextTag;
    private _buildDeploymentConfig;
    configure(deploymentOptions?: DeploymentOptions): Promise<void>;
    private _buildBaseUrl;
    private _log;
    private _logBoxen;
}
//# sourceMappingURL=deployment.d.ts.map