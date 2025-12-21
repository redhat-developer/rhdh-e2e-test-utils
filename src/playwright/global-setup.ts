/**
 * Global setup for Playwright tests.
 * This file runs once before all tests.
 */

import { KubernetesClientHelper } from "../utils/kubernetes-client.js";
import { $ } from "../utils/bash.js";
import { KeycloakHelper } from "../deployment/keycloak/index.js";
import {
  DEFAULT_KEYCLOAK_CONFIG,
  DEFAULT_RHDH_CLIENT,
} from "../deployment/keycloak/constants.js";

const REQUIRED_BINARIES = ["oc", "kubectl", "helm"] as const;

async function checkRequiredBinaries(): Promise<void> {
  const missingBinaries: string[] = [];

  for (const binary of REQUIRED_BINARIES) {
    try {
      await $`command -v ${binary} > /dev/null 2>&1`;
    } catch {
      missingBinaries.push(binary);
    }
  }

  if (missingBinaries.length > 0) {
    throw new Error(
      `ERROR: Missing required binaries: ${missingBinaries.join(", ")}. Please install them before running tests.`,
    );
  }
}

async function setClusterRouterBaseEnv(): Promise<void> {
  const k8sClient = new KubernetesClientHelper();
  process.env.K8S_CLUSTER_ROUTER_BASE =
    await k8sClient.getClusterIngressDomain();
  console.log(`Cluster router base: ${process.env.K8S_CLUSTER_ROUTER_BASE}`);
}

async function deployKeycloak(): Promise<void> {
  if (process.env.SKIP_KEYCLOAK_DEPLOYMENT) {
    console.log("Skipping Keycloak deployment");
    return;
  }

  const keycloak = new KeycloakHelper({ namespace: "rhdh-keycloak" });

  // Check if Keycloak is already running
  if (await keycloak.isRunning()) {
    console.log("Keycloak is already running, skipping deployment");
  } else {
    await keycloak.deploy();
    await keycloak.configureForRHDH();
  }

  // Set environment variables for RHDH integration
  const realm = DEFAULT_KEYCLOAK_CONFIG.realm;
  process.env.KEYCLOAK_CLIENT_SECRET = DEFAULT_RHDH_CLIENT.clientSecret;
  process.env.KEYCLOAK_CLIENT_ID = DEFAULT_RHDH_CLIENT.clientId;
  process.env.KEYCLOAK_REALM = realm;
  process.env.KEYCLOAK_LOGIN_REALM = realm;
  process.env.KEYCLOAK_METADATA_URL = `${keycloak.keycloakUrl}/realms/${realm}`;
  process.env.KEYCLOAK_BASE_URL = keycloak.keycloakUrl;

  console.table({
    keycloakURL: keycloak.keycloakUrl,
    adminUser: keycloak.deploymentConfig.adminUser,
    adminPassword: keycloak.deploymentConfig.adminPassword,
    testUsername: "test1",
    testPassword: "test1@123",
  });
}

export default async function globalSetup(): Promise<void> {
  console.log("Running global setup...");
  await checkRequiredBinaries();
  await setClusterRouterBaseEnv();
  await deployKeycloak();
  console.log("Global setup completed successfully");
}
