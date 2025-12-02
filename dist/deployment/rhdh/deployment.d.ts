import { KubernetesClientHelper } from "../../utils/kubernetes-client.js";
import type { DeploymentOptions, DeploymentConfig } from "./types.js";
export declare class RHDHDeployment {
    k8sClient: KubernetesClientHelper;
    rhdhUrl: string;
    deploymentConfig: DeploymentConfig;
    constructor(deploymentOptions: DeploymentOptions);
    deploy(): Promise<void>;
    private _applyAppConfig;
    private _applySecrets;
    private _applyDynamicPlugins;
    private _deployWithHelm;
    private _deployWithOperator;
    rolloutRestart(): Promise<void>;
    waitUntilReady(timeout?: number): Promise<void>;
    teardown(): Promise<void>;
    private _resolveChartVersion;
    private _buildDeploymentConfig;
    configure(deploymentOptions?: DeploymentOptions): Promise<void>;
    private _buildBaseUrl;
    private _log;
}
//# sourceMappingURL=deployment.d.ts.map