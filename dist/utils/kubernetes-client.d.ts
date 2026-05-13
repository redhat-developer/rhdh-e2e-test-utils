import * as k8s from "@kubernetes/client-node";
/**
 * Kubernetes client wrapper with proper abstraction
 */
declare class KubernetesClientHelper {
    private _kc;
    private _k8sApi;
    private _appsApi;
    private _customObjectsApi;
    constructor();
    /**
     * Create or update a ConfigMap from a file
     */
    createOrUpdateConfigMap(name: string, namespace: string, configFilePath: string, dataKey?: string): Promise<k8s.V1ConfigMap>;
    /**
     * Create a namespace if it doesn't exist
     */
    createNamespaceIfNotExists(namespace: string): Promise<k8s.V1Namespace>;
    /**
     * Apply a Kubernetes manifest from a YAML file
    //  */
    /**
     * Apply a Kubernetes resource dynamically
     */
    /**
     * Create or update a Secret
     */
    private _applySecret;
    /**
     * Create or update a ConfigMap from a plain object
     */
    applyConfigMapFromObject(name: string, data: Record<string, unknown>, namespace: string): Promise<void>;
    /**
     * Create or update a Secret from a plain object
     */
    applySecretFromObject(name: string, data: {
        stringData?: Record<string, string>;
    }, namespace: string): Promise<void>;
    /**
     * Delete a namespace and wait for it to be fully terminated
     */
    deleteNamespace(namespace: string, waitForDeletion?: boolean, timeoutSeconds?: number): Promise<void>;
    /**
     * Wait for a namespace to be fully deleted
     */
    private _waitForNamespaceDeletion;
    /**
     * Check if an error is a "not found" (404) error.
     * Handles different error formats from various k8s client versions.
     */
    private _isNotFoundError;
    /**
     * Check if a StatefulSet is ready (all replicas are available)
     */
    isStatefulSetReady(namespace: string, name: string): Promise<boolean>;
    /**
     * Wait for a StatefulSet to be ready (all replicas available)
     */
    waitForStatefulSetReady(namespace: string, name: string, timeoutSeconds?: number, pollIntervalMs?: number): Promise<boolean>;
    /**
     * Get the cluster's ingress domain from OpenShift config
     * Equivalent to: oc get ingresses.config.openshift.io cluster -o jsonpath='{.spec.domain}'
     */
    getClusterIngressDomain(): Promise<string>;
    /**
     * Get the URL/location of an OpenShift Route by name
     *
     * @param namespace - The namespace to search in
     * @param name - The route name
     * @returns The route URL (e.g., https://myapp.apps.cluster.example.com)
     */
    getRouteLocation(namespace: string, name: string): Promise<string>;
    /**
     * Extract the URL from a route object
     */
    private _extractRouteUrl;
    /**
     * Failure states that indicate a pod will not recover without intervention
     */
    private static readonly failureReasons;
    /**
     * Wait for pods matching a label selector to be ready, with early failure detection.
     * Fails fast when it detects unrecoverable states like CrashLoopBackOff.
     *
     * @param namespace - Namespace to watch
     * @param labelSelector - Label selector (e.g., "app=myapp")
     * @param timeoutSeconds - Maximum time to wait (default: 300)
     * @param pollIntervalMs - How often to check pod status (default: 5000)
     */
    waitForPodsWithFailureDetection(namespace: string, labelSelector: string, timeoutSeconds?: number, pollIntervalMs?: number): Promise<void>;
    /**
     * Collects diagnostic logs for all resources in a namespace and saves them as files.
     * Uses kubectl for cross-platform compatibility (works on OpenShift, EKS, GKE, etc.).
     * OpenShift-specific resources (routes) are collected on a best-effort basis.
     *
     * @param namespace - Namespace to collect diagnostics from
     * @param outputDir - Directory to write log files to (defaults to playwright-report/logs/<namespace>)
     */
    collectDiagnosticLogs(namespace: string, outputDir?: string): Promise<void>;
    /**
     * Check if a pod is in a failure state. Returns failure info or null if healthy.
     */
    private _checkPodFailure;
}
export { KubernetesClientHelper };
//# sourceMappingURL=kubernetes-client.d.ts.map