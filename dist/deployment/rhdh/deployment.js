import { KubernetesClientHelper } from "../../utils/kubernetes-client.js";
import { $ } from "../../utils/bash.js";
import yaml from "js-yaml";
import { test } from "@playwright/test";
import { mergeYamlFilesIfExists } from "../../utils/merge-yamls.js";
import { envsubst } from "../../utils/common.js";
import fs from "fs-extra";
import boxen from "boxen";
import { DEFAULT_CONFIG_PATHS, CHART_URL } from "./constants.js";
export class RHDHDeployment {
    k8sClient = new KubernetesClientHelper();
    rhdhUrl;
    deploymentConfig;
    constructor(deploymentOptions) {
        this.deploymentConfig = this._buildDeploymentConfig(deploymentOptions);
        this.rhdhUrl = this._buildBaseUrl();
        this._log(`RHDH deployment initialized (namespace: ${this.deploymentConfig.namespace})`);
        console.table(this.deploymentConfig);
    }
    async deploy() {
        this._log("Starting RHDH deployment...");
        test.setTimeout(500_000);
        await this.k8sClient.createNamespaceIfNotExists(this.deploymentConfig.namespace);
        await this._applyAppConfig();
        await this._applySecrets();
        if (this.deploymentConfig.method === "helm") {
            await this._deployWithHelm(this.deploymentConfig.valueFile);
        }
        else {
            await this._applyDynamicPlugins();
            await this._deployWithOperator(this.deploymentConfig.subscription);
        }
        await this.waitUntilReady();
    }
    async _applyAppConfig() {
        const appConfigYaml = await mergeYamlFilesIfExists([
            DEFAULT_CONFIG_PATHS.appConfig,
            this.deploymentConfig.appConfig,
        ]);
        console.log(boxen(yaml.dump(appConfigYaml), {
            title: "App Config",
            padding: 1,
            align: "left",
        }));
        await this.k8sClient.applyConfigMapFromObject("app-config-rhdh", appConfigYaml, this.deploymentConfig.namespace);
    }
    async _applySecrets() {
        const secretsYaml = await mergeYamlFilesIfExists([
            DEFAULT_CONFIG_PATHS.secrets,
            this.deploymentConfig.secrets,
        ]);
        await this.k8sClient.applySecretFromObject("rhdh-secrets", JSON.parse(envsubst(JSON.stringify(secretsYaml))), this.deploymentConfig.namespace);
    }
    async _applyDynamicPlugins() {
        const dynamicPluginsYaml = await mergeYamlFilesIfExists([
            DEFAULT_CONFIG_PATHS.dynamicPlugins,
            this.deploymentConfig.dynamicPlugins,
        ]);
        console.log(boxen(yaml.dump(dynamicPluginsYaml), {
            title: "Dynamic Plugins",
            padding: 1,
            align: "left",
        }));
        await this.k8sClient.applyConfigMapFromObject("dynamic-plugins", dynamicPluginsYaml, this.deploymentConfig.namespace);
    }
    async _deployWithHelm(valueFile) {
        const chartVersion = await this._resolveChartVersion(this.deploymentConfig.version);
        this._log(`Helm chart version resolved to: ${chartVersion}`);
        const valueFileObject = (await mergeYamlFilesIfExists([
            DEFAULT_CONFIG_PATHS.helm.valueFile,
            valueFile,
        ]));
        console.log(boxen(yaml.dump(valueFileObject), {
            title: "Value File",
            padding: 1,
            align: "left",
        }));
        // Merge dynamic plugins into the values file
        if (!valueFileObject.global) {
            valueFileObject.global = {};
        }
        valueFileObject.global.dynamic = await mergeYamlFilesIfExists([
            DEFAULT_CONFIG_PATHS.dynamicPlugins,
            this.deploymentConfig.dynamicPlugins,
        ]);
        fs.writeFileSync(`/tmp/${this.deploymentConfig.namespace}-value-file.yaml`, yaml.dump(valueFileObject));
        await $ `
      helm upgrade redhat-developer-hub -i "${process.env.CHART_URL || CHART_URL}" --version "${chartVersion}" \
        -f "/tmp/${this.deploymentConfig.namespace}-value-file.yaml" \
        --set global.clusterRouterBase="${process.env.K8S_CLUSTER_ROUTER_BASE}" \
        --namespace="${this.deploymentConfig.namespace}"
    `;
        this._log(`Helm deployment completed successfully`);
    }
    async _deployWithOperator(subscription) {
        const subscriptionObject = await mergeYamlFilesIfExists([
            DEFAULT_CONFIG_PATHS.operator.subscription,
            subscription,
        ]);
        console.log(boxen(yaml.dump(subscriptionObject), {
            title: "Subscription",
            padding: 1,
            align: "left",
        }));
        fs.writeFileSync(`/tmp/${this.deploymentConfig.namespace}-subscription.yaml`, yaml.dump(subscriptionObject));
        await $ `
      set -e;
      curl -s https://raw.githubusercontent.com/redhat-developer/rhdh-operator/refs/heads/release-${this.deploymentConfig.version}/.rhdh/scripts/install-rhdh-catalog-source.sh | bash -s -- -v ${this.deploymentConfig.version} --install-operator rhdh

      timeout 300 bash -c '
        while ! oc get crd/backstages.rhdh.redhat.com -n "${this.deploymentConfig.namespace}" >/dev/null 2>&1; do
          echo "Waiting for Backstage CRD to be created..."
          sleep 20
        done
        echo "Backstage CRD is created."
      ' || echo "Error: Timed out waiting for Backstage CRD creation."

      oc apply -f "/tmp/${this.deploymentConfig.namespace}-subscription.yaml" -n "${this.deploymentConfig.namespace}"
    `;
        this._log("Operator deployment executed successfully.");
    }
    async rolloutRestart() {
        this._log(`Restarting RHDH deployment in namespace ${this.deploymentConfig.namespace}...`);
        await $ `oc rollout restart deployment -l 'app.kubernetes.io/instance in (redhat-developer-hub,developer-hub)' -n ${this.deploymentConfig.namespace}`;
        this._log(`RHDH deployment restarted successfully in namespace ${this.deploymentConfig.namespace}`);
        await this.waitUntilReady();
    }
    async waitUntilReady(timeout = 300) {
        this._log(`Waiting for RHDH deployment to be ready in namespace ${this.deploymentConfig.namespace}...`);
        try {
            await $ `oc rollout status deployment -l 'app.kubernetes.io/instance in (redhat-developer-hub,developer-hub)' -n ${this.deploymentConfig.namespace} --timeout=${timeout}s`;
            this._log(`RHDH deployment is ready in namespace ${this.deploymentConfig.namespace}`);
        }
        catch (error) {
            this._log(`Error waiting for RHDH deployment to be ready in timeout ${timeout}s in namespace ${this.deploymentConfig.namespace}: ${error}`);
            throw error;
        }
    }
    async teardown() {
        await this.k8sClient.deleteNamespace(this.deploymentConfig.namespace);
    }
    async _resolveChartVersion(version) {
        // Semantic versions (e.g., 1.2)
        if (/^(\d+(\.\d+)?)$/.test(version)) {
            const response = await fetch("https://quay.io/api/v1/repository/rhdh/chart/tag/?onlyActiveTags=true&limit=600");
            if (!response.ok)
                throw new Error(`Failed to fetch chart versions: ${response.statusText}`);
            const data = (await response.json());
            const matching = data.tags
                .map((t) => t.name)
                .filter((name) => name.startsWith(`${version}-`))
                .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
            const latest = matching.at(-1);
            if (!latest)
                throw new Error(`No chart version found for ${version}`);
            return latest;
        }
        // CI build versions (e.g., 1.2.3-CI)
        if (version.endsWith("CI"))
            return version;
        throw new Error(`Invalid Helm chart version format: "${version}"`);
    }
    _buildDeploymentConfig(input) {
        const version = input.version ?? process.env.RHDH_VERSION;
        const method = input.method ?? process.env.INSTALLATION_METHOD;
        if (!version)
            throw new Error("RHDH version is required");
        if (!method)
            throw new Error("Installation method (helm/operator) is required");
        const base = {
            version,
            namespace: input.namespace,
            appConfig: input.appConfig ?? `config/app-config-rhdh.yaml`,
            secrets: input.secrets ?? `config/rhdh-secrets.yaml`,
            dynamicPlugins: input.dynamicPlugins ?? `config/dynamic-plugins.yaml`,
        };
        if (method === "helm") {
            return {
                ...base,
                method,
                valueFile: input.valueFile ?? `config/value_file.yaml`,
            };
        }
        else if (method === "operator") {
            return {
                ...base,
                method,
                subscription: input.subscription ?? `config/subscription.yaml`,
            };
        }
        else {
            throw new Error(`Invalid RHDH installation method: ${method}`);
        }
    }
    async configure(deploymentOptions) {
        if (deploymentOptions) {
            this.deploymentConfig = this._buildDeploymentConfig(deploymentOptions);
            this.rhdhUrl = this._buildBaseUrl();
            this._log(`RHDH deployment initialized (namespace: ${this.deploymentConfig.namespace})`);
            console.table(this.deploymentConfig);
        }
        await this.k8sClient.createNamespaceIfNotExists(this.deploymentConfig.namespace);
    }
    _buildBaseUrl() {
        const prefix = this.deploymentConfig.method === "helm"
            ? "redhat-developer-hub"
            : "backstage-developer-hub";
        const baseUrl = `https://${prefix}-${this.deploymentConfig.namespace}.${process.env.K8S_CLUSTER_ROUTER_BASE}`;
        process.env.RHDH_BASE_URL = baseUrl;
        return baseUrl;
    }
    _log(...args) {
        console.log("[RHDHDeployment]", ...args);
    }
}
