import { $ } from "./bash.js";
import * as k8s from "@kubernetes/client-node";
import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
$.verbose = true;
/**
 * Kubernetes client wrapper with proper abstraction
 */
class KubernetesClientHelper {
    _kc;
    _k8sApi;
    _appsApi;
    _customObjectsApi;
    constructor() {
        this._kc = new k8s.KubeConfig();
        this._kc.loadFromDefault();
        try {
            this._k8sApi = this._kc.makeApiClient(k8s.CoreV1Api);
            this._appsApi = this._kc.makeApiClient(k8s.AppsV1Api);
            this._customObjectsApi = this._kc.makeApiClient(k8s.CustomObjectsApi);
        }
        catch (error) {
            if (error instanceof Error &&
                error.message.includes("No active cluster")) {
                const currentContext = this._kc.getCurrentContext();
                const contexts = this._kc.getContexts().map((c) => c.name);
                throw new Error(`No active Kubernetes cluster found.\n\n` +
                    `The kubeconfig was loaded but no cluster is configured or the current context is invalid.\n\n` +
                    `Current context: ${currentContext || "(none)"}\n` +
                    `Available contexts: ${contexts.length > 0 ? contexts.join(", ") : "(none)"}\n\n` +
                    `To fix this:\n` +
                    `  1. Log in to your k8s cluster: oc login or kubectl login\n` +
                    `  2. Or set a valid context: kubectl config use-context <context-name>\n` +
                    `  3. Verify your connection: oc whoami && oc cluster-info\n\n` +
                    `Kubeconfig locations checked:\n` +
                    `  - KUBECONFIG env: ${process.env.KUBECONFIG || "(not set)"}\n` +
                    `  - Default: ~/.kube/config`, { cause: error });
            }
            throw error;
        }
    }
    /**
     * Create or update a ConfigMap from a file
     */
    async createOrUpdateConfigMap(name, namespace, configFilePath, dataKey) {
        try {
            const fileContent = fs.readFileSync(configFilePath, "utf-8");
            const key = dataKey || path.basename(configFilePath);
            const configMap = {
                apiVersion: "v1",
                kind: "ConfigMap",
                metadata: {
                    name,
                    namespace,
                },
                data: {
                    [key]: fileContent,
                },
            };
            // Check if ConfigMap exists first
            try {
                await this._k8sApi.readNamespacedConfigMap({ name, namespace });
                // Exists, so update it
                const response = await this._k8sApi.replaceNamespacedConfigMap({
                    name,
                    namespace,
                    body: configMap,
                });
                console.log(`✓ Updated ConfigMap ${name} in namespace ${namespace}`);
                return response;
            }
            catch {
                // Doesn't exist, create it
                const response = await this._k8sApi.createNamespacedConfigMap({
                    namespace,
                    body: configMap,
                });
                console.log(`✓ Created ConfigMap ${name} in namespace ${namespace}`);
                return response;
            }
        }
        catch (error) {
            console.error(`✗ Failed to create/update ConfigMap ${name}:`, error instanceof Error ? error.message : error);
            throw error;
        }
    }
    /**
     * Create a namespace if it doesn't exist
     */
    async createNamespaceIfNotExists(namespace) {
        if (!namespace?.trim())
            throw new Error("Namespace is required");
        try {
            const response = await this._k8sApi.readNamespace({ name: namespace });
            console.log(`✓ Namespace ${namespace} already exists`);
            return response;
        }
        catch {
            // If read fails (likely 404), try to create
            try {
                const namespaceObj = {
                    apiVersion: "v1",
                    kind: "Namespace",
                    metadata: {
                        name: namespace,
                    },
                };
                const response = await this._k8sApi.createNamespace({
                    body: namespaceObj,
                });
                console.log(`✓ Created namespace ${namespace}`);
                return response;
            }
            catch (createError) {
                console.error(`✗ Failed to create namespace ${namespace}:`, createError instanceof Error ? createError.message : createError);
                throw createError;
            }
        }
    }
    /**
     * Apply a Kubernetes manifest from a YAML file
    //  */
    // async applyManifest(filePath: string, namespace: string): Promise<void> {
    //   try {
    //     const fileContent = fs.readFileSync(filePath, "utf-8");
    //     const docs = yaml.loadAll(fileContent) as any[];
    //     for (const doc of docs) {
    //       if (!doc || !doc.kind) continue;
    //       doc.metadata = doc.metadata || {};
    //       doc.metadata.namespace = namespace;
    //       await this.applyResource(doc, namespace);
    //     }
    //   } catch (error: any) {
    //     console.error(`✗ Failed to apply manifest ${filePath}:`, error.message);
    //     throw error;
    //   }
    // }
    /**
     * Apply a Kubernetes resource dynamically
     */
    // private async applyResource(resource: any, namespace: string): Promise<void> {
    //   const kind = resource.kind;
    //   const name = resource.metadata.name;
    //   try {
    //     switch (kind) {
    //       case "Secret":
    //         await this.applySecret(resource, namespace);
    //         break;
    //       case "ConfigMap":
    //         await this.applyConfigMap(resource, namespace);
    //         break;
    //       default:
    //         console.warn(`⚠ Skipping unsupported resource type: ${kind}`);
    //     }
    //   } catch (error: any) {
    //     console.error(`✗ Failed to apply ${kind} ${name}:`, error.message);
    //     throw error;
    //   }
    // }
    /**
     * Create or update a Secret
     */
    async _applySecret(secret, namespace) {
        const name = secret.metadata.name;
        try {
            await this._k8sApi.replaceNamespacedSecret({
                name,
                namespace,
                body: secret,
            });
            console.log(`✓ Updated Secret ${name} in namespace ${namespace}`);
        }
        catch {
            // If replace fails (likely 404), try to create
            try {
                await this._k8sApi.createNamespacedSecret({
                    namespace,
                    body: secret,
                });
                console.log(`✓ Created Secret ${name} in namespace ${namespace}`);
            }
            catch (createError) {
                console.error(`✗ Failed to create/update Secret ${name} in namespace ${namespace}:`, createError instanceof Error ? createError.message : createError);
                throw createError;
            }
        }
    }
    /**
     * Create or update a ConfigMap from a plain object
     */
    async applyConfigMapFromObject(name, data, namespace) {
        // Convert the data object to a YAML string
        const yamlContent = yaml.dump(data);
        // Create proper ConfigMap structure
        const fullConfigMap = {
            apiVersion: "v1",
            kind: "ConfigMap",
            metadata: {
                name,
                namespace,
            },
            data: {
                [name + ".yaml"]: yamlContent,
            },
        };
        try {
            await this._k8sApi.replaceNamespacedConfigMap({
                name,
                namespace,
                body: fullConfigMap,
            });
            console.log(`✓ Updated ConfigMap ${name} in namespace ${namespace}`);
        }
        catch {
            // Check for 404 status in different possible error structures
            try {
                await this._k8sApi.createNamespacedConfigMap({
                    namespace,
                    body: fullConfigMap,
                });
                console.log(`✓ Created ConfigMap ${name} in namespace ${namespace}`);
            }
            catch (createError) {
                console.error(`✗ Failed to create/update ConfigMap ${name} in namespace ${namespace}:`, createError instanceof Error ? createError.message : createError);
                throw createError;
            }
        }
    }
    /**
     * Create or update a Secret from a plain object
     */
    async applySecretFromObject(name, data, namespace) {
        // Create proper Secret structure
        const fullSecret = {
            apiVersion: "v1",
            kind: "Secret",
            metadata: {
                name,
                namespace,
            },
            stringData: data.stringData,
        };
        try {
            await this._k8sApi.replaceNamespacedSecret({
                name,
                namespace,
                body: fullSecret,
            });
            console.log(`✓ Updated Secret ${name} in namespace ${namespace}`);
        }
        catch {
            // If replace fails (likely 404), try to create
            try {
                await this._k8sApi.createNamespacedSecret({
                    namespace,
                    body: fullSecret,
                });
                console.log(`✓ Created Secret ${name} in namespace ${namespace}`);
            }
            catch (createError) {
                console.error(`✗ Failed to create/update Secret ${name} in namespace ${namespace}:`, createError instanceof Error ? createError.message : createError);
                throw createError;
            }
        }
    }
    /**
     * Delete a namespace and wait for it to be fully terminated
     */
    async deleteNamespace(namespace, waitForDeletion = true, timeoutSeconds = 180) {
        try {
            await this._k8sApi.deleteNamespace({ name: namespace });
            console.log(`[K8sHelper] Deleting namespace ${namespace}...`);
        }
        catch (error) {
            // Ignore if namespace doesn't exist (already deleted), but throw other errors
            if (this._isNotFoundError(error)) {
                console.log(`✓ Namespace ${namespace} already deleted or doesn't exist`);
                return;
            }
            else {
                console.error(`✗ Failed to delete namespace ${namespace}:`, error instanceof Error ? error.message : error);
                throw error;
            }
        }
        if (waitForDeletion) {
            await this._waitForNamespaceDeletion(namespace, timeoutSeconds);
        }
    }
    /**
     * Wait for a namespace to be fully deleted
     */
    async _waitForNamespaceDeletion(namespace, timeoutSeconds = 180) {
        const startTime = Date.now();
        const timeoutMs = timeoutSeconds * 1000;
        const pollIntervalMs = 3000;
        while (Date.now() - startTime < timeoutMs) {
            try {
                const ns = await this._k8sApi.readNamespace({ name: namespace });
                const phase = ns.status?.phase;
                // Namespace still exists, wait and retry
                if (phase === "Terminating") {
                    // Only log occasionally to avoid spam
                    const elapsed = Math.round((Date.now() - startTime) / 1000);
                    if (elapsed % 10 === 0) {
                        console.log(`[K8sHelper] Namespace ${namespace} still terminating (${elapsed}s)...`);
                    }
                }
                await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
            }
            catch (error) {
                // Check for 404 in various error formats from different k8s client versions
                if (this._isNotFoundError(error)) {
                    console.log(`✓ Namespace ${namespace} fully deleted`);
                    return;
                }
                throw error;
            }
        }
        throw new Error(`Timeout waiting for namespace ${namespace} to be deleted after ${timeoutSeconds}s`);
    }
    /**
     * Check if an error is a "not found" (404) error.
     * Handles different error formats from various k8s client versions.
     */
    _isNotFoundError(error) {
        if (!error)
            return false;
        // Check error message for "404" or "not found"
        if (error instanceof Error) {
            const msg = error.message.toLowerCase();
            if (msg.includes("404") || msg.includes("not found")) {
                return true;
            }
        }
        // Check various object properties for 404 status codes
        const err = error;
        return (err.body?.code === 404 ||
            err.response?.statusCode === 404 ||
            err.statusCode === 404 ||
            err.code === 404);
    }
    /**
     * Check if a StatefulSet is ready (all replicas are available)
     */
    async isStatefulSetReady(namespace, name) {
        try {
            const statefulSet = await this._appsApi.readNamespacedStatefulSet({
                name,
                namespace,
            });
            const replicas = statefulSet.spec?.replicas ?? 1;
            const readyReplicas = statefulSet.status?.readyReplicas ?? 0;
            return readyReplicas >= replicas;
        }
        catch {
            return false;
        }
    }
    /**
     * Wait for a StatefulSet to be ready (all replicas available)
     */
    async waitForStatefulSetReady(namespace, name, timeoutSeconds = 300, pollIntervalMs = 5000) {
        const startTime = Date.now();
        const timeoutMs = timeoutSeconds * 1000;
        while (Date.now() - startTime < timeoutMs) {
            if (await this.isStatefulSetReady(namespace, name)) {
                console.log(`✓ StatefulSet ${name} is ready`);
                return true;
            }
            await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
        }
        throw new Error(`StatefulSet ${name} in namespace ${namespace} not ready after ${timeoutSeconds}s`);
    }
    /**
     * Get the cluster's ingress domain from OpenShift config
     * Equivalent to: oc get ingresses.config.openshift.io cluster -o jsonpath='{.spec.domain}'
     */
    async getClusterIngressDomain() {
        try {
            const ingress = await this._customObjectsApi.getClusterCustomObject({
                group: "config.openshift.io",
                version: "v1",
                plural: "ingresses",
                name: "cluster",
            });
            const domain = ingress.spec?.domain;
            if (!domain) {
                throw new Error("Ingress domain not found in cluster config");
            }
            return domain;
        }
        catch (error) {
            throw new Error(`Failed to get cluster ingress domain: ${error instanceof Error ? error.message : error}`, { cause: error });
        }
    }
    /**
     * Get the URL/location of an OpenShift Route by name
     *
     * @param namespace - The namespace to search in
     * @param name - The route name
     * @returns The route URL (e.g., https://myapp.apps.cluster.example.com)
     */
    async getRouteLocation(namespace, name) {
        try {
            const route = await this._customObjectsApi.getNamespacedCustomObject({
                group: "route.openshift.io",
                version: "v1",
                namespace,
                plural: "routes",
                name,
            });
            return this._extractRouteUrl(route, name);
        }
        catch (error) {
            throw new Error(`Failed to get route ${name} in namespace ${namespace}: ${error instanceof Error ? error.message : error}`, { cause: error });
        }
    }
    /**
     * Extract the URL from a route object
     */
    _extractRouteUrl(route, routeName) {
        const routeObj = route;
        // Try to get host from spec first, then from status
        const host = routeObj.spec?.host || routeObj.status?.ingress?.[0]?.host;
        if (!host) {
            throw new Error(`Route ${routeName} does not have a host configured`);
        }
        // Determine protocol based on TLS configuration
        const protocol = routeObj.spec?.tls ? "https" : "http";
        return `${protocol}://${host}`;
    }
    /**
     * Failure states that indicate a pod will not recover without intervention
     */
    static failureReasons = new Set([
        "CrashLoopBackOff",
        "Error",
        "ImagePullBackOff",
        "ErrImagePull",
        "InvalidImageName",
        "CreateContainerConfigError",
        "CreateContainerError",
    ]);
    /**
     * Wait for pods matching a label selector to be ready, with early failure detection.
     * Fails fast when it detects unrecoverable states like CrashLoopBackOff.
     *
     * @param namespace - Namespace to watch
     * @param labelSelector - Label selector (e.g., "app=myapp")
     * @param timeoutSeconds - Maximum time to wait (default: 300)
     * @param pollIntervalMs - How often to check pod status (default: 5000)
     */
    async waitForPodsWithFailureDetection(namespace, labelSelector, timeoutSeconds = 500, pollIntervalMs = 5000) {
        const startTime = Date.now();
        const timeoutMs = timeoutSeconds * 1000;
        console.log(`[K8sHelper] Waiting for pods (${labelSelector}) in ${namespace}...`);
        while (Date.now() - startTime < timeoutMs) {
            let pods;
            try {
                pods = (await this._k8sApi.listNamespacedPod({ namespace, labelSelector })).items;
            }
            catch (err) {
                console.log(`[K8sHelper] API error, retrying: ${err}`);
                await new Promise((r) => setTimeout(r, pollIntervalMs));
                continue;
            }
            if (pods.length === 0) {
                await new Promise((r) => setTimeout(r, pollIntervalMs));
                continue;
            }
            for (const pod of pods) {
                const podName = pod.metadata?.name || "unknown";
                const failure = this._checkPodFailure(pod);
                if (failure) {
                    console.log(`[K8sHelper] Pod ${podName} failed: ${failure.reason}`);
                    try {
                        if (failure.container) {
                            await $ `oc logs ${podName} -n ${namespace} -c ${failure.container} --tail=100`;
                        }
                        else {
                            await $ `oc logs ${podName} -n ${namespace} --tail=100`;
                        }
                    }
                    catch {
                        // Ignore log fetch errors
                    }
                    throw new Error(`Pod ${podName} failed: ${failure.reason}`);
                }
            }
            // Check if all pods are ready
            const allReady = pods.every((pod) => {
                const ready = pod.status?.conditions?.find((c) => c.type === "Ready");
                return ready?.status === "True";
            });
            if (allReady) {
                console.log(`[K8sHelper] All ${pods.length} pod(s) ready in ${namespace}`);
                return;
            }
            // Log pod status every 20 seconds
            const elapsedSec = Math.floor((Date.now() - startTime) / 1000);
            if (elapsedSec > 0 && elapsedSec % 20 === 0) {
                try {
                    await $ `oc get pods -n ${namespace} -l ${labelSelector}`;
                }
                catch {
                    // Ignore errors
                }
            }
            await new Promise((r) => setTimeout(r, pollIntervalMs));
        }
        // Timeout reached - print diagnostics to stdio before throwing
        console.log(`\n[K8sHelper] ═══ Pod Diagnostics (timeout reached) ═══`);
        try {
            console.log(`\n[K8sHelper] ─── Pod Status ───`);
            await $ `oc get pods -n ${namespace} -l ${labelSelector} -o wide`;
            console.log(`\n[K8sHelper] ─── Pod Logs ───`);
            await $ `oc logs -n ${namespace} -l ${labelSelector} --all-containers --tail=100 2>&1 || true`;
        }
        catch {
            // Ignore errors from diagnostic commands
        }
        console.log(`\n[K8sHelper] ═══ End Pod Diagnostics ═══\n`);
        throw new Error(`Timeout waiting for pods (${labelSelector}) after ${timeoutSeconds}s`);
    }
    /**
     * Collects diagnostic logs for all resources in a namespace and saves them as files.
     * Uses kubectl for cross-platform compatibility (works on OpenShift, EKS, GKE, etc.).
     * OpenShift-specific resources (routes) are collected on a best-effort basis.
     *
     * @param namespace - Namespace to collect diagnostics from
     * @param outputDir - Directory to write log files to (defaults to playwright-report/logs/<namespace>)
     */
    async collectDiagnosticLogs(namespace, outputDir = path.join("node_modules", ".cache", "e2e-test-results", "logs", namespace)) {
        fs.mkdirSync(outputDir, { recursive: true });
        console.log(`[K8sHelper] Collecting diagnostic logs for "${namespace}" → ${outputDir}`);
        const quiet = $({
            stdio: ["pipe", "pipe", "pipe"],
            timeout: "20s",
        });
        const save = async (filePath, cmd) => {
            try {
                const result = await cmd;
                fs.mkdirSync(path.dirname(filePath), { recursive: true });
                fs.writeFileSync(filePath, result.stdout);
            }
            catch {
                // ignore — resource type may not exist on this cluster
            }
        };
        await Promise.allSettled([
            save(path.join(outputDir, "events.txt"), quiet `kubectl get events -n ${namespace} --sort-by='.lastTimestamp'`),
            save(path.join(outputDir, "pods.txt"), quiet `kubectl get pods -n ${namespace} -o wide`),
            save(path.join(outputDir, "describe-pods.txt"), quiet `kubectl describe pods -n ${namespace}`),
            save(path.join(outputDir, "deployments.txt"), quiet `kubectl get deployments -n ${namespace} -o wide`),
            save(path.join(outputDir, "describe-deployments.txt"), quiet `kubectl describe deployments -n ${namespace}`),
            save(path.join(outputDir, "statefulsets.txt"), quiet `kubectl get statefulsets -n ${namespace} -o wide`),
            save(path.join(outputDir, "routes.txt"), quiet `kubectl get routes -n ${namespace} -o wide`),
        ]);
        try {
            const pods = (await this._k8sApi.listNamespacedPod({ namespace })).items;
            const saveLogs = async (filePath, cmd) => {
                try {
                    const result = await cmd;
                    if (result.stdout.trim()) {
                        fs.mkdirSync(path.dirname(filePath), { recursive: true });
                        fs.writeFileSync(filePath, result.stdout);
                    }
                }
                catch {
                    // ignore — container may not have started or no previous logs
                }
            };
            await Promise.allSettled(pods
                .filter((pod) => pod.metadata?.name)
                .flatMap((pod) => {
                const podName = pod.metadata.name;
                const podDir = path.join(outputDir, "pods", podName);
                const containers = [
                    ...(pod.spec?.initContainers ?? []),
                    ...(pod.spec?.containers ?? []),
                ];
                return containers
                    .filter((c) => c.name)
                    .flatMap((c) => [
                    saveLogs(path.join(podDir, `${c.name}.log`), quiet `kubectl logs ${podName} -n ${namespace} -c ${c.name}`),
                    saveLogs(path.join(podDir, `${c.name}.previous.log`), quiet `kubectl logs ${podName} -n ${namespace} -c ${c.name} --previous`),
                ]);
            }));
        }
        catch {
            // ignore
        }
    }
    /**
     * Check if a pod is in a failure state. Returns failure info or null if healthy.
     */
    _checkPodFailure(pod) {
        // Check init containers first
        for (const cs of pod.status?.initContainerStatuses || []) {
            const reason = cs.state?.waiting?.reason;
            if (reason && KubernetesClientHelper.failureReasons.has(reason)) {
                return { reason: `Init:${reason}`, container: cs.name };
            }
            if (cs.state?.terminated?.exitCode &&
                cs.state.terminated.exitCode !== 0) {
                return {
                    reason: `Init:Error (exit ${cs.state.terminated.exitCode})`,
                    container: cs.name,
                };
            }
        }
        // Check main containers
        for (const cs of pod.status?.containerStatuses || []) {
            const reason = cs.state?.waiting?.reason;
            if (reason && KubernetesClientHelper.failureReasons.has(reason)) {
                return { reason, container: cs.name };
            }
        }
        return null;
    }
}
export { KubernetesClientHelper };
