import path from "path";
// Navigate from dist/deployment/rhdh/ to package root
const PACKAGE_ROOT = path.resolve(import.meta.dirname, "../../..");
export const DEFAULT_CONFIG_PATHS = {
    appConfig: path.join(PACKAGE_ROOT, "src/deployment/rhdh/config/app-config-rhdh.yaml"),
    secrets: path.join(PACKAGE_ROOT, "src/deployment/rhdh/config/rhdh-secrets.yaml"),
    dynamicPlugins: path.join(PACKAGE_ROOT, "src/deployment/rhdh/config/dynamic-plugins.yaml"),
    helm: {
        valueFile: path.join(PACKAGE_ROOT, "src/deployment/rhdh/helm/value_file.yaml"),
    },
    operator: {
        subscription: path.join(PACKAGE_ROOT, "src/deployment/rhdh/operator/subscription.yaml"),
    },
};
export const CHART_URL = "oci://quay.io/rhdh/chart";
