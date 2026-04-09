import { KubernetesClientHelper } from "../../utils/kubernetes-client.js";
import { WorkspacePaths } from "../../utils/workspace-paths.js";
import { $ } from "../../utils/bash.js";
import yaml from "js-yaml";
import os from "os";
import path from "path";
import { test, request, expect } from "@playwright/test";
import { mergeYamlFilesIfExists, deepMerge } from "../../utils/merge-yamls.js";
import {
  generatePluginsFromMetadata,
  processPluginsForDeployment,
  getNormalizedPluginMergeKey,
  disablePluginWrappers,
  type DynamicPluginsConfig,
} from "../../utils/plugin-metadata.js";
import { envsubst } from "../../utils/common.js";
import { runOnce } from "../../playwright/run-once.js";
import cloneDeepWith from "lodash.clonedeepwith";
import fs from "fs-extra";
import {
  DEFAULT_CONFIG_PATHS,
  AUTH_CONFIG_PATHS,
  CHART_URL,
} from "./constants.js";
import type {
  DeploymentOptions,
  DeploymentConfig,
  DeploymentConfigBase,
  DeploymentMethod,
} from "./types.js";

export class RHDHDeployment {
  public k8sClient = new KubernetesClientHelper();
  public rhdhUrl: string;
  public deploymentConfig: DeploymentConfig;

  constructor(namespace: string) {
    this.deploymentConfig = this._buildDeploymentConfig({ namespace });
    this.rhdhUrl = this._buildBaseUrl();
  }

  async deploy(options?: { timeout?: number | null }): Promise<void> {
    // Default 600s, custom number to override, null to skip and let consumer control the timeout
    const timeout = options?.timeout === undefined ? 600_000 : options.timeout;
    if (timeout !== null) {
      test.setTimeout(timeout);
    }

    const executed = await runOnce(
      `deploy-${this.deploymentConfig.namespace}`,
      async () => {
        this._log("Starting RHDH deployment...");
        this._log("RHDH Base URL: " + this.rhdhUrl);
        console.table(this.deploymentConfig);

        await this.k8sClient.createNamespaceIfNotExists(
          this.deploymentConfig.namespace,
        );

        await this._applyAppConfig();
        await this._applySecrets();

        if (this.deploymentConfig.method === "helm") {
          const isUpgrade = await this._deploymentExists();
          await this._deployWithHelm(this.deploymentConfig.valueFile);
          if (isUpgrade) {
            await this.scaleDownAndRestart(); // Restart as helm does not monitor config changes
          }
        } else {
          await this._applyDynamicPlugins();
          await this._deployWithOperator(this.deploymentConfig.subscription);
        }
        await this.waitUntilReady();
      },
    );

    if (!executed) {
      this._log(
        `Deployment already completed for namespace "${this.deploymentConfig.namespace}", skipping`,
      );
    }
  }

  private async _applyAppConfig(): Promise<void> {
    const authConfig = AUTH_CONFIG_PATHS[this.deploymentConfig.auth];
    const appConfigYaml = await mergeYamlFilesIfExists(
      [
        DEFAULT_CONFIG_PATHS.appConfig,
        authConfig.appConfig,
        this.deploymentConfig.appConfig,
      ],
      authConfig.mergeStrategy,
    );
    this._logBoxen("App Config", appConfigYaml);

    await this.k8sClient.applyConfigMapFromObject(
      "app-config-rhdh",
      appConfigYaml,
      this.deploymentConfig.namespace,
    );
  }

  private async _applySecrets(): Promise<void> {
    const authConfig = AUTH_CONFIG_PATHS[this.deploymentConfig.auth];
    const secretsYaml = await mergeYamlFilesIfExists([
      DEFAULT_CONFIG_PATHS.secrets,
      authConfig.secrets,
      this.deploymentConfig.secrets,
    ]);

    // Use cloneDeepWith to substitute env vars in-place, avoiding JSON.parse issues
    // with control characters in secrets (e.g., private keys with newlines)
    const substituted = cloneDeepWith(secretsYaml, (value: unknown) => {
      if (typeof value === "string") return envsubst(value);
    });

    await this.k8sClient.applySecretFromObject(
      "rhdh-secrets",
      substituted as { stringData?: Record<string, string> },
      this.deploymentConfig.namespace,
    );
  }

  /** Shared merge strategy for dynamic plugin arrays. */
  private static readonly pluginMergeOpts = {
    arrayMergeStrategy: { byKey: "package" },
  } as const;

  /**
   * Merges package defaults + auth config (+ optional user config) into a
   * single dynamic plugins configuration.
   */
  private async _mergeBaseConfigs(
    userConfigPath?: string,
  ): Promise<Record<string, unknown>> {
    const authConfig = AUTH_CONFIG_PATHS[this.deploymentConfig.auth];
    const paths = [
      DEFAULT_CONFIG_PATHS.dynamicPlugins,
      authConfig.dynamicPlugins,
      ...(userConfigPath ? [userConfigPath] : []),
    ];
    return await mergeYamlFilesIfExists(paths, RHDHDeployment.pluginMergeOpts);
  }

  /**
   * Merges a generated plugin config with the base (defaults + auth) config.
   */
  private async _mergeGeneratedWithBase(
    generatedConfig: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const baseConfig = await this._mergeBaseConfigs();
    // Use normalizeKey so OCI and local path for the same logical plugin
    // (e.g., keycloak from metadata OCI + auth local path with -dynamic suffix)
    // are deduplicated; generated (metadata) wins so OCI URL is kept.
    return deepMerge(baseConfig, generatedConfig, {
      arrayMergeStrategy: {
        byKey: "package",
        normalizeKey: (item) =>
          getNormalizedPluginMergeKey(item as Record<string, unknown>),
      },
    });
  }

  /**
   * Builds the merged dynamic plugins configuration.
   *
   * 1. Assembles raw config: user-provided OR auto-generated from metadata
   * 2. Processes for deployment: injects metadata (PR) + resolves all packages to OCI
   *
   * The processing step is shared — processPluginsForDeployment handles
   * both PR and nightly via isNightlyJob() and GIT_PR_NUMBER detection.
   */
  private async _buildDynamicPluginsConfig(): Promise<Record<string, unknown>> {
    const userConfigPath = this.deploymentConfig.dynamicPlugins;
    const userConfigExists = userConfigPath && fs.existsSync(userConfigPath);
    const wrapperPlugins = disablePluginWrappers(
      this.deploymentConfig.disableWrappers,
    );

    let config: Record<string, unknown>;

    if (userConfigExists) {
      this._log(`Using user config: ${userConfigPath}`);
      config = await this._mergeBaseConfigs(userConfigPath);
    } else {
      this._log(
        `No user config at '${userConfigPath}', auto-generating from metadata...`,
      );
      const generated = await generatePluginsFromMetadata(
        WorkspacePaths.metadataDir,
      );
      config = await this._mergeGeneratedWithBase(generated);
    }

    // Process for deployment: inject metadata (PR only) + resolve all packages to OCI
    let result = await processPluginsForDeployment(
      config as DynamicPluginsConfig,
      WorkspacePaths.metadataDir,
    );

    // Disable wrapper plugins (PR builds only)
    if (process.env.GIT_PR_NUMBER) {
      result = deepMerge(result, wrapperPlugins, {
        arrayMergeStrategy: "concat",
      }) as DynamicPluginsConfig;
    }

    return result;
  }

  private async _applyDynamicPlugins(): Promise<void> {
    const dynamicPluginsYaml = await this._buildDynamicPluginsConfig();

    this._logBoxen("Dynamic Plugins", dynamicPluginsYaml);
    await this.k8sClient.applyConfigMapFromObject(
      "dynamic-plugins",
      dynamicPluginsYaml,
      this.deploymentConfig.namespace,
    );
  }

  private async _deployWithHelm(valueFile: string): Promise<void> {
    const chartVersion = await this._resolveChartVersion(
      this.deploymentConfig.version,
    );
    this._log(`Helm chart version resolved to: ${chartVersion}`);
    const valueFileObject = (await mergeYamlFilesIfExists([
      DEFAULT_CONFIG_PATHS.helm.valueFile,
      valueFile,
    ])) as Record<string, Record<string, unknown>>;

    this._logBoxen("Value File", valueFileObject);

    // Merge dynamic plugins into the values file (including auth-specific plugins)
    if (!valueFileObject.global) {
      valueFileObject.global = {};
    }
    valueFileObject.global.dynamic = await this._buildDynamicPluginsConfig();

    // Set catalog index image if CATALOG_INDEX_IMAGE env var is provided.
    // The catalog index provides dynamic-plugins.default.yaml with default plugin
    // configurations and versions for the RHDH release.
    const catalogIndexImage = process.env.CATALOG_INDEX_IMAGE;
    if (catalogIndexImage) {
      const [imageRef, tag] = catalogIndexImage.split(":");
      const firstSlash = imageRef.indexOf("/");
      valueFileObject.global.catalogIndex = {
        image: {
          registry: imageRef.substring(0, firstSlash),
          repository: imageRef.substring(firstSlash + 1),
          tag: tag || "latest",
        },
      };
      this._log(`Catalog index image: ${catalogIndexImage}`);
    }

    this._logBoxen("Dynamic Plugins", valueFileObject.global.dynamic);

    // Escape {{inherit}} for Helm's Go template engine.
    // The RHDH chart uses `tpl` on dynamic plugin values, so {{inherit}} would be
    // interpreted as a Go template action. Escaping to {{ "{{inherit}}" }} produces
    // the literal string {{inherit}} after template rendering.
    const valuesYaml = yaml
      .dump(valueFileObject)
      .replace(/\{\{inherit\}\}/g, '{{ "{{inherit}}" }}');

    const valueFilePath = path.join(
      os.tmpdir(),
      `${this.deploymentConfig.namespace}-value-file.yaml`,
    );
    fs.writeFileSync(valueFilePath, valuesYaml);

    await $`
      helm upgrade redhat-developer-hub -i "${process.env.CHART_URL || CHART_URL}" --version "${chartVersion}" \
        -f "${valueFilePath}" \
        --set global.clusterRouterBase="${process.env.K8S_CLUSTER_ROUTER_BASE}" \
        --namespace="${this.deploymentConfig.namespace}"
    `;

    this._log(`Helm deployment completed successfully`);
  }

  private async _deployWithOperator(subscription: string): Promise<void> {
    const subscriptionObject = (await mergeYamlFilesIfExists([
      DEFAULT_CONFIG_PATHS.operator.subscription,
      subscription,
    ])) as Record<string, Record<string, Record<string, unknown>>>;

    // Set catalog index image if CATALOG_INDEX_IMAGE env var is provided.
    const catalogIndexImage = process.env.CATALOG_INDEX_IMAGE;
    if (catalogIndexImage) {
      const spec = (subscriptionObject.spec ??= {});
      const app = (spec.application ??= {}) as Record<string, unknown>;
      const extraEnvs = ((app.extraEnvs as Record<string, unknown>) ??=
        {}) as Record<string, unknown>;
      const envs = ((extraEnvs.envs as Array<Record<string, unknown>>) ??=
        []) as Array<Record<string, unknown>>;
      envs.push({
        name: "CATALOG_INDEX_IMAGE",
        value: catalogIndexImage,
        containers: ["install-dynamic-plugins"],
      });
      this._log(`Catalog index image: ${catalogIndexImage}`);
    }

    this._logBoxen("Subscription", subscriptionObject);
    const subscriptionFilePath = path.join(
      os.tmpdir(),
      `${this.deploymentConfig.namespace}-subscription.yaml`,
    );
    fs.writeFileSync(subscriptionFilePath, yaml.dump(subscriptionObject));

    const version = this.deploymentConfig.version;
    const isSemanticVersion = /^\d+(\.\d+)?$/.test(version);

    // Use main branch for non-semantic versions (e.g., "next", "latest")
    const branch = isSemanticVersion ? `release-${version}` : "main";

    // Build version argument based on version type
    let versionArg: string;
    if (isSemanticVersion) {
      versionArg = `-v ${version}`;
    } else if (version === "next") {
      versionArg = "--next";
    } else {
      throw new Error(
        `Invalid RHDH version "${version}". Use semantic version (e.g., "1.5") or "next".`,
      );
    }

    this._log(`Using operator branch: ${branch}, version arg: ${versionArg}`);

    await $`
      set -e;
      curl -sf https://raw.githubusercontent.com/redhat-developer/rhdh-operator/refs/heads/${branch}/.rhdh/scripts/install-rhdh-catalog-source.sh | bash -s -- ${versionArg} --install-operator rhdh

      timeout 300 bash -c '
        while ! oc get crd/backstages.rhdh.redhat.com -n "${this.deploymentConfig.namespace}" >/dev/null 2>&1; do
          echo "Waiting for Backstage CRD to be created..."
          sleep 20
        done
        echo "Backstage CRD is created."
      ' || echo "Error: Timed out waiting for Backstage CRD creation."

      oc apply -f "${subscriptionFilePath}" -n "${this.deploymentConfig.namespace}"
    `;

    this._log("Operator deployment executed successfully.");
  }

  async rolloutRestart(): Promise<void> {
    this._log(
      `Restarting RHDH deployment in namespace ${this.deploymentConfig.namespace}...`,
    );
    await $`oc rollout restart deployment -l 'app.kubernetes.io/instance in (redhat-developer-hub,developer-hub)' -n ${this.deploymentConfig.namespace}`;
    this._log(
      `RHDH deployment restarted successfully in namespace ${this.deploymentConfig.namespace}`,
    );
    await this.waitUntilReady();
  }

  /**
   * Performs a clean restart by scaling down to 0 first, waiting for pods to terminate,
   * then scaling back up. This prevents MigrationLocked errors by ensuring no pods
   * hold database locks when new pods start.
   */
  async scaleDownAndRestart(): Promise<void> {
    const namespace = this.deploymentConfig.namespace;
    await $`oc scale deployment -l 'app.kubernetes.io/instance in (redhat-developer-hub,developer-hub)' --replicas=0 -n ${namespace}`;
    await $`oc wait --for=delete pod -l 'app.kubernetes.io/instance in (redhat-developer-hub,developer-hub),app.kubernetes.io/name!=postgresql' -n ${namespace} --timeout=120s || true`;
    await $`oc scale deployment -l 'app.kubernetes.io/instance in (redhat-developer-hub,developer-hub)' --replicas=1 -n ${namespace}`;
  }

  async waitUntilReady(timeout: number = 500): Promise<void> {
    const namespace = this.deploymentConfig.namespace;
    const labelSelector =
      "app.kubernetes.io/instance in (redhat-developer-hub,developer-hub)";
    const startTime = Date.now();

    try {
      await this.k8sClient.waitForPodsWithFailureDetection(
        namespace,
        labelSelector,
        timeout,
      );
    } catch (error) {
      throw new Error(
        `RHDH deployment failed in ${namespace}: ${error instanceof Error ? error.message : error}`,
        { cause: error },
      );
    }

    // Use remaining timeout for route readiness check
    const remaining = timeout * 1000 - (Date.now() - startTime);
    await expect(async () => {
      const context = await request.newContext({ ignoreHTTPSErrors: true });
      const response = await context.get(this.rhdhUrl);
      await context.dispose();
      expect(response.ok()).toBeTruthy();
    }).toPass({ timeout: Math.max(remaining, 30_000), intervals: [5_000] });
    this._log(`RHDH is ready in ${namespace}`);
  }

  async teardown(): Promise<void> {
    await this.k8sClient.deleteNamespace(this.deploymentConfig.namespace);
  }

  private async _deploymentExists(): Promise<boolean> {
    try {
      await $`oc get deployment redhat-developer-hub -n ${this.deploymentConfig.namespace} --no-headers 2>/dev/null`;
      return true;
    } catch {
      return false;
    }
  }

  private async _resolveChartVersion(version: string): Promise<string> {
    let resolvedVersion = version;

    // Handle "next" tag by looking up the corresponding version from downstream image
    if (version === "next") {
      resolvedVersion = await this._resolveVersionFromNextTag();
      this._log(`Resolved "next" tag to version: ${resolvedVersion}`);
    }

    // Semantic versions (e.g., 1.2, 1.10)
    if (/^(\d+(\.\d+)?)$/.test(resolvedVersion)) {
      const response = await fetch(
        "https://quay.io/api/v1/repository/rhdh/chart/tag/?onlyActiveTags=true&limit=600",
      );

      if (!response.ok)
        throw new Error(
          `Failed to fetch chart versions: ${response.statusText}`,
        );

      const data = (await response.json()) as { tags: Array<{ name: string }> };
      const matching = data.tags
        .map((t) => t.name)
        .filter((name) => name.startsWith(`${resolvedVersion}-`))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

      const latest = matching.at(-1);
      if (!latest)
        throw new Error(`No chart version found for ${resolvedVersion}`);
      return latest;
    }

    // CI build versions (e.g., 1.2.3-CI)
    if (resolvedVersion.endsWith("CI")) return resolvedVersion;

    throw new Error(`Invalid Helm chart version format: "${version}"`);
  }

  /**
   * Resolve the semantic version from the "next" tag by looking up the
   * downstream image (rhdh-hub-rhel9) and finding tags with the same digest.
   */
  private async _resolveVersionFromNextTag(): Promise<string> {
    // Fetch all active tags in a single API call
    const response = await fetch(
      "https://quay.io/api/v1/repository/rhdh/rhdh-hub-rhel9/tag/?onlyActiveTags=true&limit=75",
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch image tags: ${response.statusText}`);
    }

    // Use Record to avoid snake_case linting issues with Quay API response
    const data = (await response.json()) as {
      tags: Array<Record<string, unknown>>;
    };

    // Find the "next" tag and get its digest
    const nextTag = data.tags.find((t) => t["name"] === "next");
    if (!nextTag) {
      throw new Error('No "next" tag found in rhdh-hub-rhel9 repository');
    }

    const digest = nextTag["manifest_digest"] as string;
    this._log(`"next" tag digest: ${digest}`);

    // Find semantic version tag (e.g., "1.10") with the same digest
    const semanticVersionTag = data.tags.find(
      (t) =>
        t["manifest_digest"] === digest &&
        /^\d+\.\d+$/.test(t["name"] as string),
    );

    if (!semanticVersionTag) {
      throw new Error(
        `Could not find semantic version tag for "next" (digest: ${digest})`,
      );
    }

    return semanticVersionTag["name"] as string;
  }

  private _buildDeploymentConfig(input: DeploymentOptions): DeploymentConfig {
    // Default to "next" if RHDH_VERSION not set
    const version = input.version ?? process.env.RHDH_VERSION ?? "next";
    // Default to "helm" if INSTALLATION_METHOD not set
    const method =
      input.method ??
      (process.env.INSTALLATION_METHOD as DeploymentMethod) ??
      "helm";

    const base: DeploymentConfigBase = {
      version,
      namespace: input.namespace ?? this.deploymentConfig.namespace,
      auth: input.auth ?? "keycloak",
      appConfig: input.appConfig ?? WorkspacePaths.appConfig,
      secrets: input.secrets ?? WorkspacePaths.secrets,
      dynamicPlugins: input.dynamicPlugins ?? WorkspacePaths.dynamicPlugins,
      disableWrappers: input.disableWrappers ?? [],
    };

    if (method === "helm") {
      return {
        ...base,
        method,
        valueFile: input.valueFile ?? WorkspacePaths.valueFile,
      };
    } else if (method === "operator") {
      return {
        ...base,
        method,
        subscription: input.subscription ?? WorkspacePaths.subscription,
      };
    } else {
      throw new Error(`Invalid RHDH installation method: ${method}`);
    }
  }

  async configure(deploymentOptions?: DeploymentOptions): Promise<void> {
    if (deploymentOptions) {
      this.deploymentConfig = this._buildDeploymentConfig(deploymentOptions);
      this.rhdhUrl = this._buildBaseUrl();
    }
    await this.k8sClient.createNamespaceIfNotExists(
      this.deploymentConfig.namespace,
    );
  }

  private _buildBaseUrl(): string {
    const prefix =
      this.deploymentConfig.method === "helm"
        ? "redhat-developer-hub"
        : "backstage-developer-hub";
    const baseUrl = `https://${prefix}-${this.deploymentConfig.namespace}.${process.env.K8S_CLUSTER_ROUTER_BASE}`;
    process.env.RHDH_BASE_URL = baseUrl;
    return baseUrl;
  }

  private _log(...args: unknown[]): void {
    console.log("[RHDHDeployment]", ...args);
  }

  private _logBoxen(title: string, data: unknown): void {
    const content = yaml.dump(data, { lineWidth: -1 });
    console.log(`\n┌─ ${title} ${"─".repeat(60)}`);
    console.log(content);
    console.log(`└${"─".repeat(60 + title.length + 3)}\n`);
  }
}
