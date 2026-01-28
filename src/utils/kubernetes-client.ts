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
  private _kc: k8s.KubeConfig;
  private _k8sApi: k8s.CoreV1Api;
  private _appsApi: k8s.AppsV1Api;
  private _customObjectsApi: k8s.CustomObjectsApi;

  constructor() {
    this._kc = new k8s.KubeConfig();
    this._kc.loadFromDefault();

    try {
      this._k8sApi = this._kc.makeApiClient(k8s.CoreV1Api);
      this._appsApi = this._kc.makeApiClient(k8s.AppsV1Api);
      this._customObjectsApi = this._kc.makeApiClient(k8s.CustomObjectsApi);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("No active cluster")
      ) {
        const currentContext = this._kc.getCurrentContext();
        const contexts = this._kc.getContexts().map((c) => c.name);

        throw new Error(
          `No active Kubernetes cluster found.\n\n` +
            `The kubeconfig was loaded but no cluster is configured or the current context is invalid.\n\n` +
            `Current context: ${currentContext || "(none)"}\n` +
            `Available contexts: ${contexts.length > 0 ? contexts.join(", ") : "(none)"}\n\n` +
            `To fix this:\n` +
            `  1. Log in to your k8s cluster: oc login or kubectl login\n` +
            `  2. Or set a valid context: kubectl config use-context <context-name>\n` +
            `  3. Verify your connection: oc whoami && oc cluster-info\n\n` +
            `Kubeconfig locations checked:\n` +
            `  - KUBECONFIG env: ${process.env.KUBECONFIG || "(not set)"}\n` +
            `  - Default: ~/.kube/config`,
        );
      }
      throw error;
    }
  }

  /**
   * Create or update a ConfigMap from a file
   */
  async createOrUpdateConfigMap(
    name: string,
    namespace: string,
    configFilePath: string,
    dataKey?: string,
  ): Promise<k8s.V1ConfigMap> {
    try {
      const fileContent = fs.readFileSync(configFilePath, "utf-8");
      const key = dataKey || path.basename(configFilePath);

      const configMap: k8s.V1ConfigMap = {
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
      } catch {
        // Doesn't exist, create it
        const response = await this._k8sApi.createNamespacedConfigMap({
          namespace,
          body: configMap,
        });
        console.log(`✓ Created ConfigMap ${name} in namespace ${namespace}`);
        return response;
      }
    } catch (error) {
      console.error(
        `✗ Failed to create/update ConfigMap ${name}:`,
        error instanceof Error ? error.message : error,
      );
      throw error;
    }
  }

  /**
   * Create a namespace if it doesn't exist
   */
  async createNamespaceIfNotExists(
    namespace: string,
  ): Promise<k8s.V1Namespace> {
    if (!namespace?.trim()) throw new Error("Namespace is required");
    try {
      const response = await this._k8sApi.readNamespace({ name: namespace });
      console.log(`✓ Namespace ${namespace} already exists`);
      return response;
    } catch {
      // If read fails (likely 404), try to create
      try {
        const namespaceObj: k8s.V1Namespace = {
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
      } catch (createError) {
        console.error(
          `✗ Failed to create namespace ${namespace}:`,
          createError instanceof Error ? createError.message : createError,
        );
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
  private async _applySecret(
    secret: k8s.V1Secret,
    namespace: string,
  ): Promise<void> {
    const name = secret.metadata!.name!;
    try {
      await this._k8sApi.replaceNamespacedSecret({
        name,
        namespace,
        body: secret,
      });
      console.log(`✓ Updated Secret ${name} in namespace ${namespace}`);
    } catch {
      // If replace fails (likely 404), try to create
      try {
        await this._k8sApi.createNamespacedSecret({
          namespace,
          body: secret,
        });
        console.log(`✓ Created Secret ${name} in namespace ${namespace}`);
      } catch (createError) {
        console.error(
          `✗ Failed to create/update Secret ${name} in namespace ${namespace}:`,
          createError instanceof Error ? createError.message : createError,
        );
        throw createError;
      }
    }
  }

  /**
   * Create or update a ConfigMap from a plain object
   */
  async applyConfigMapFromObject(
    name: string,
    data: Record<string, unknown>,
    namespace: string,
  ): Promise<void> {
    // Convert the data object to a YAML string
    const yamlContent = yaml.dump(data);

    // Create proper ConfigMap structure
    const fullConfigMap: k8s.V1ConfigMap = {
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
    } catch {
      // Check for 404 status in different possible error structures
      try {
        await this._k8sApi.createNamespacedConfigMap({
          namespace,
          body: fullConfigMap,
        });
        console.log(`✓ Created ConfigMap ${name} in namespace ${namespace}`);
      } catch (createError) {
        console.error(
          `✗ Failed to create/update ConfigMap ${name} in namespace ${namespace}:`,
          createError instanceof Error ? createError.message : createError,
        );
        throw createError;
      }
    }
  }

  /**
   * Create or update a Secret from a plain object
   */
  async applySecretFromObject(
    name: string,
    data: { stringData?: Record<string, string> },
    namespace: string,
  ): Promise<void> {
    // Create proper Secret structure
    const fullSecret: k8s.V1Secret = {
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
    } catch {
      // If replace fails (likely 404), try to create
      try {
        await this._k8sApi.createNamespacedSecret({
          namespace,
          body: fullSecret,
        });
        console.log(`✓ Created Secret ${name} in namespace ${namespace}`);
      } catch (createError) {
        console.error(
          `✗ Failed to create/update Secret ${name} in namespace ${namespace}:`,
          createError instanceof Error ? createError.message : createError,
        );
        throw createError;
      }
    }
  }

  /**
   * Delete a namespace
   */
  async deleteNamespace(namespace: string): Promise<void> {
    try {
      await this._k8sApi.deleteNamespace({ name: namespace });
      console.log(`✓ Deleted namespace ${namespace}`);
    } catch (error) {
      // Ignore if namespace doesn't exist (already deleted), but throw other errors
      const err = error as {
        body?: { code?: number };
        response?: { statusCode?: number };
        statusCode?: number;
      };
      if (
        err.body?.code === 404 ||
        err.response?.statusCode === 404 ||
        err.statusCode === 404
      ) {
        console.log(
          `✓ Namespace ${namespace} already deleted or doesn't exist`,
        );
      } else {
        console.error(
          `✗ Failed to delete namespace ${namespace}:`,
          error instanceof Error ? error.message : error,
        );
        throw error;
      }
    }
  }

  /**
   * Check if a StatefulSet is ready (all replicas are available)
   */
  async isStatefulSetReady(namespace: string, name: string): Promise<boolean> {
    try {
      const statefulSet = await this._appsApi.readNamespacedStatefulSet({
        name,
        namespace,
      });
      const replicas = statefulSet.spec?.replicas ?? 1;
      const readyReplicas = statefulSet.status?.readyReplicas ?? 0;
      return readyReplicas >= replicas;
    } catch {
      return false;
    }
  }

  /**
   * Wait for a StatefulSet to be ready (all replicas available)
   */
  async waitForStatefulSetReady(
    namespace: string,
    name: string,
    timeoutSeconds: number = 300,
    pollIntervalMs: number = 5000,
  ): Promise<boolean> {
    const startTime = Date.now();
    const timeoutMs = timeoutSeconds * 1000;

    while (Date.now() - startTime < timeoutMs) {
      if (await this.isStatefulSetReady(namespace, name)) {
        console.log(`✓ StatefulSet ${name} is ready`);
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(
      `StatefulSet ${name} in namespace ${namespace} not ready after ${timeoutSeconds}s`,
    );
  }

  /**
   * Get the cluster's ingress domain from OpenShift config
   * Equivalent to: oc get ingresses.config.openshift.io cluster -o jsonpath='{.spec.domain}'
   */
  async getClusterIngressDomain(): Promise<string> {
    try {
      const ingress = await this._customObjectsApi.getClusterCustomObject({
        group: "config.openshift.io",
        version: "v1",
        plural: "ingresses",
        name: "cluster",
      });

      const domain = (ingress as { spec?: { domain?: string } }).spec?.domain;
      if (!domain) {
        throw new Error("Ingress domain not found in cluster config");
      }

      return domain;
    } catch (error) {
      throw new Error(
        `Failed to get cluster ingress domain: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  /**
   * Get the URL/location of an OpenShift Route by name
   *
   * @param namespace - The namespace to search in
   * @param name - The route name
   * @returns The route URL (e.g., https://myapp.apps.cluster.example.com)
   */
  async getRouteLocation(namespace: string, name: string): Promise<string> {
    try {
      const route = await this._customObjectsApi.getNamespacedCustomObject({
        group: "route.openshift.io",
        version: "v1",
        namespace,
        plural: "routes",
        name,
      });

      return this._extractRouteUrl(route, name);
    } catch (error) {
      throw new Error(
        `Failed to get route ${name} in namespace ${namespace}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  /**
   * Extract the URL from a route object
   */
  private _extractRouteUrl(route: unknown, routeName: string): string {
    const routeObj = route as {
      spec?: { host?: string; tls?: unknown };
      status?: { ingress?: Array<{ host?: string }> };
    };

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
  private static readonly failureReasons = new Set([
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
  async waitForPodsWithFailureDetection(
    namespace: string,
    labelSelector: string,
    timeoutSeconds: number = 300,
    pollIntervalMs: number = 5000,
  ): Promise<void> {
    const startTime = Date.now();
    const timeoutMs = timeoutSeconds * 1000;

    console.log(
      `[K8sHelper] Waiting for pods (${labelSelector}) in ${namespace}...`,
    );

    while (Date.now() - startTime < timeoutMs) {
      let pods: k8s.V1Pod[];
      try {
        pods = (
          await this._k8sApi.listNamespacedPod({ namespace, labelSelector })
        ).items;
      } catch (err) {
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
              await $`oc logs ${podName} -n ${namespace} -c ${failure.container} --tail=100`;
            } else {
              await $`oc logs ${podName} -n ${namespace} --tail=100`;
            }
          } catch {
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
        console.log(
          `[K8sHelper] All ${pods.length} pod(s) ready in ${namespace}`,
        );
        return;
      }

      await new Promise((r) => setTimeout(r, pollIntervalMs));
    }

    throw new Error(
      `Timeout waiting for pods (${labelSelector}) after ${timeoutSeconds}s`,
    );
  }

  /**
   * Check if a pod is in a failure state. Returns failure info or null if healthy.
   */
  private _checkPodFailure(
    pod: k8s.V1Pod,
  ): { reason: string; container?: string } | null {
    // Check init containers first
    for (const cs of pod.status?.initContainerStatuses || []) {
      const reason = cs.state?.waiting?.reason;
      if (reason && KubernetesClientHelper.failureReasons.has(reason)) {
        return { reason: `Init:${reason}`, container: cs.name };
      }
      if (
        cs.state?.terminated?.exitCode &&
        cs.state.terminated.exitCode !== 0
      ) {
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
