import path from "path";
import type { AuthProvider } from "./types.js";

// Navigate from dist/deployment/rhdh/ to package root
const PACKAGE_ROOT = path.resolve(import.meta.dirname, "../../..");

export const DEFAULT_CONFIG_PATHS = {
  appConfig: path.join(
    PACKAGE_ROOT,
    "dist/deployment/rhdh/config/common/app-config-rhdh.yaml",
  ),
  secrets: path.join(
    PACKAGE_ROOT,
    "dist/deployment/rhdh/config/common/rhdh-secrets.yaml",
  ),
  dynamicPlugins: path.join(
    PACKAGE_ROOT,
    "dist/deployment/rhdh/config/common/dynamic-plugins.yaml",
  ),
  helm: {
    valueFile: path.join(
      PACKAGE_ROOT,
      "dist/deployment/rhdh/config/helm/value_file.yaml",
    ),
  },
  operator: {
    subscription: path.join(
      PACKAGE_ROOT,
      "dist/deployment/rhdh/config/operator/subscription.yaml",
    ),
  },
};

export const AUTH_CONFIG_PATHS: Record<
  AuthProvider,
  { appConfig: string; secrets: string; dynamicPlugins: string }
> = {
  guest: {
    appConfig: path.join(
      PACKAGE_ROOT,
      "dist/deployment/rhdh/config/auth/guest/app-config.yaml",
    ),
    secrets: "",
    dynamicPlugins: "",
  },
  keycloak: {
    appConfig: path.join(
      PACKAGE_ROOT,
      "dist/deployment/rhdh/config/auth/keycloak/app-config.yaml",
    ),
    secrets: path.join(
      PACKAGE_ROOT,
      "dist/deployment/rhdh/config/auth/keycloak/secrets.yaml",
    ),
    dynamicPlugins: path.join(
      PACKAGE_ROOT,
      "dist/deployment/rhdh/config/auth/keycloak/dynamic-plugins.yaml",
    ),
  },
  github: {
    appConfig: path.join(
      PACKAGE_ROOT,
      "dist/deployment/rhdh/config/auth/github/app-config.yaml",
    ),
    secrets: path.join(
      PACKAGE_ROOT,
      "dist/deployment/rhdh/config/auth/github/secrets.yaml",
    ),
    dynamicPlugins: path.join(
      PACKAGE_ROOT,
      "dist/deployment/rhdh/config/auth/github/dynamic-plugins.yaml",
    ),
  },
};

export const CHART_URL = "oci://quay.io/rhdh/chart";
