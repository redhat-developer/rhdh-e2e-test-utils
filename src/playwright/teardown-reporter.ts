import type { Reporter, Suite } from "@playwright/test/reporter";
import { KubernetesClientHelper } from "../utils/kubernetes-client.js";
import { getTeardownNamespaces } from "./teardown-namespaces.js";

/**
 * Playwright reporter that deletes namespaces after all tests complete.
 * Runs in the main process, so it survives worker restarts.
 * Only active when process.env.CI is set.
 *
 * By default, deletes the namespace matching the project name.
 * For custom namespaces, consumers can register them via registerTeardownNamespace().
 */
export default class TeardownReporter implements Reporter {
  private _projects = new Set<string>();

  onBegin(_config: unknown, suite: Suite): void {
    for (const test of suite.allTests()) {
      const name = test.parent.project()?.name;
      if (name) this._projects.add(name);
    }
  }

  async onEnd(): Promise<void> {
    if (!process.env.CI) return;

    let k8sClient: KubernetesClientHelper;
    try {
      k8sClient = new KubernetesClientHelper();
    } catch (error) {
      console.error(
        `[TeardownReporter] Cannot connect to cluster, skipping teardown:`,
        error,
      );
      return;
    }

    for (const projectName of this._projects) {
      const customNamespaces = getTeardownNamespaces(projectName);
      const namespaces =
        customNamespaces.length > 0 ? customNamespaces : [projectName];

      for (const ns of namespaces) {
        console.log(
          `[TeardownReporter] Deleting namespace "${ns}" (project: ${projectName})`,
        );
        await k8sClient.deleteNamespace(ns);
      }
    }
  }
}
