import * as k8s from "@kubernetes/client-node";
/**
 * Kubernetes client wrapper with proper abstraction
 */
declare class KubernetesClientHelper {
    private _kc;
    private _k8sApi;
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
     * Delete a namespace
     */
    deleteNamespace(namespace: string): Promise<void>;
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
}
export { KubernetesClientHelper };
//# sourceMappingURL=kubernetes-client.d.ts.map