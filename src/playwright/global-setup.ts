/**
 * Global setup for Playwright tests.
 * This file runs once before all tests.
 */

import { type FullConfig } from "@playwright/test";
import dotenv from "dotenv";
import { resolve } from "path";
import { KubernetesClientHelper } from "../utils/kubernetes-client.js";
import { $ } from "../utils/bash.js";
import { KeycloakHelper } from "../deployment/keycloak/index.js";
import { installRHDHOperator } from "../deployment/rhdh/operator-setup.js";
import { removeProviderEnvironmentVariables } from "../secrets/environment.js";
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
  if (process.env.SKIP_KEYCLOAK_DEPLOYMENT === "true") {
    console.log("Skipping Keycloak deployment");
    return;
  }
  console.log(
    "Set SKIP_KEYCLOAK_DEPLOYMENT=true if test doesn't require keycloak/oidc as auth provider",
  );

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

  console.log(`Keycloak URL: ${keycloak.keycloakUrl}`);
}

export default async function globalSetup(config: FullConfig): Promise<void> {
  console.log("Running global setup...");
  await checkRequiredBinaries();
  loadDotenvFromProjects(config);
  removeProviderEnvironmentVariables(process.env);
  await setClusterRouterBaseEnv();
  await Promise.all([installRHDHOperator(), deployKeycloak()]);
  console.log("Global setup completed successfully");
}

/**
 * Loads .env files from each project's e2e-tests directory.
 * Existing values supplied by the caller take priority over local .env values.
 */
export function loadDotenvFromProjects(config: FullConfig): void {
  const seen = new Set<string>();
  for (const project of config.projects) {
    // testDir points to e2e-tests/tests, go up one level to e2e-tests/
    const e2eRoot = resolve(project.testDir, "..");
    if (seen.has(e2eRoot)) continue;
    seen.add(e2eRoot);
    dotenv.config({ path: resolve(e2eRoot, ".env"), override: false });
  }
  removeProviderEnvironmentVariables(process.env);
}
