/**
 * Global setup for Playwright tests.
 * This file runs once before all tests.
 */

import { KubernetesClientHelper } from "../utils/kubernetes-client.js";
import { $ } from "../utils/bash.js";

const REQUIRED_BINARIES = ["oc", "kubectl", "helm"] as const;

async function checkRequiredBinaries(): Promise<void> {
  const missingBinaries: string[] = [];

  for (const binary of REQUIRED_BINARIES) {
    try {
      await $`which ${binary}`;
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

export default async function globalSetup(): Promise<void> {
  console.log("Running global setup...");
  await checkRequiredBinaries();
  await setClusterRouterBaseEnv();
}
