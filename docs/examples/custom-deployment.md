# Custom Deployment

Examples of custom RHDH configuration.

## Custom App Config

```typescript
import { test } from "rhdh-e2e-test-utils/test";

test.beforeAll(async ({ rhdh }) => {
  await rhdh.configure({
    version: "1.5",
    method: "helm",
    auth: "keycloak",
    appConfig: "tests/config/custom-app-config.yaml",
    secrets: "tests/config/custom-secrets.yaml",
    dynamicPlugins: "tests/config/custom-plugins.yaml",
    valueFile: "tests/config/custom-values.yaml",
  });

  await rhdh.deploy();
});
```

## Pre-Deployment Setup

```typescript
import { test } from "rhdh-e2e-test-utils/test";
import { $ } from "rhdh-e2e-test-utils/utils";

test.beforeAll(async ({ rhdh }) => {
  const namespace = rhdh.deploymentConfig.namespace;

  // Configure first (creates namespace)
  await rhdh.configure({ auth: "keycloak" });

  // Run custom setup script
  await $`bash scripts/setup-data-source.sh ${namespace}`;

  // Get route from deployed service
  const result = await $`oc get route data-source -n ${namespace} -o jsonpath='{.spec.host}'`;
  process.env.DATA_SOURCE_URL = result.stdout.trim();

  // Deploy RHDH (uses env vars)
  await rhdh.deploy();
});
```

## Dynamic ConfigMaps

```typescript
import { test } from "rhdh-e2e-test-utils/test";

test.beforeAll(async ({ rhdh }) => {
  await rhdh.configure({ auth: "keycloak" });

  // Add custom ConfigMap before deployment
  await rhdh.k8sClient.applyConfigMapFromObject(
    "custom-data",
    {
      "data.json": JSON.stringify({ key: "value" }),
    },
    rhdh.deploymentConfig.namespace
  );

  await rhdh.deploy();
});
```

## Runtime Secrets

```typescript
import { test } from "rhdh-e2e-test-utils/test";

test.beforeAll(async ({ rhdh }) => {
  // Set secrets at runtime
  process.env.GITHUB_TOKEN = await getSecretFromVault("github-token");
  process.env.API_KEY = await getSecretFromVault("api-key");

  await rhdh.configure({ auth: "keycloak" });
  await rhdh.deploy();
});

async function getSecretFromVault(name: string): Promise<string> {
  // Your vault integration
  return "secret-value";
}
```

## Update Configuration During Test

```typescript
import { test } from "rhdh-e2e-test-utils/test";

test("update and restart", async ({ rhdh }) => {
  const namespace = rhdh.deploymentConfig.namespace;

  // Update ConfigMap
  await rhdh.k8sClient.applyConfigMapFromObject(
    "app-config-rhdh",
    {
      "app-config.yaml": `
        app:
          title: Updated Title
      `,
    },
    namespace
  );

  // Restart to apply
  await rhdh.rolloutRestart();

  // Continue testing with new config
});
```

## Custom Helm Values

**tests/config/custom-values.yaml:**
```yaml
global:
  clusterRouterBase: ${K8S_CLUSTER_ROUTER_BASE}

upstream:
  backstage:
    image:
      registry: quay.io
      repository: rhdh/rhdh-hub-rhel9
      tag: ${RHDH_VERSION}

    extraEnvVars:
      - name: LOG_LEVEL
        value: "debug"
      - name: CUSTOM_FLAG
        value: "enabled"

    extraEnvVarsSecrets:
      - rhdh-secrets
      - custom-secrets

    resources:
      requests:
        memory: "2Gi"
        cpu: "1000m"
      limits:
        memory: "4Gi"
        cpu: "2000m"

  postgresql:
    enabled: true
    primary:
      persistence:
        size: 10Gi
```

## Multiple Deployments

```typescript
import { RHDHDeployment } from "rhdh-e2e-test-utils/rhdh";

// Create multiple deployments
const deployment1 = new RHDHDeployment("instance-1");
const deployment2 = new RHDHDeployment("instance-2");

await Promise.all([
  deployment1.configure({ auth: "guest" }).then(() => deployment1.deploy()),
  deployment2.configure({ auth: "keycloak" }).then(() => deployment2.deploy()),
]);

console.log(`Instance 1: ${deployment1.rhdhUrl}`);
console.log(`Instance 2: ${deployment2.rhdhUrl}`);
```
