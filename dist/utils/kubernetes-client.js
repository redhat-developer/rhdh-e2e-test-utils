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
    _customObjectsApi;
    constructor() {
        this._kc = new k8s.KubeConfig();
        this._kc.loadFromDefault();
        this._k8sApi = this._kc.makeApiClient(k8s.CoreV1Api);
        this._customObjectsApi = this._kc.makeApiClient(k8s.CustomObjectsApi);
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
     * Delete a namespace
     */
    async deleteNamespace(namespace) {
        try {
            await this._k8sApi.deleteNamespace({ name: namespace });
            console.log(`✓ Deleted namespace ${namespace}`);
        }
        catch (error) {
            // Ignore if namespace doesn't exist (already deleted), but throw other errors
            const err = error;
            if (err.body?.code === 404 ||
                err.response?.statusCode === 404 ||
                err.statusCode === 404) {
                console.log(`✓ Namespace ${namespace} already deleted or doesn't exist`);
            }
            else {
                console.error(`✗ Failed to delete namespace ${namespace}:`, error instanceof Error ? error.message : error);
                throw error;
            }
        }
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
            throw new Error(`Failed to get cluster ingress domain: ${error instanceof Error ? error.message : error}`);
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
            throw new Error(`Failed to get route ${name} in namespace ${namespace}: ${error instanceof Error ? error.message : error}`);
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
}
export { KubernetesClientHelper };
