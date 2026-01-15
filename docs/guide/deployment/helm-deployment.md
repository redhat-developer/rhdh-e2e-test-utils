# Helm Deployment

Deploy RHDH using the official Helm chart.

## Configuration

Set the installation method to `helm`:

```typescript
await rhdh.configure({
  method: "helm",
  valueFile: "tests/config/value_file.yaml",
});
```

Or via environment variable:

```bash
INSTALLATION_METHOD="helm"
```

## Helm Values File

Create a custom values file to override Helm chart defaults.

### Example: `tests/config/value_file.yaml`

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
      - name: NODE_TLS_REJECT_UNAUTHORIZED
        value: "0"

    appConfig:
      # App config is mounted from ConfigMap
      # See app-config-rhdh.yaml

  postgresql:
    enabled: true
    auth:
      secretKeys:
        adminPasswordKey: postgres-password
        userPasswordKey: password
```

## Default Chart URL

The default Helm chart URL is:

```
oci://quay.io/rhdh/chart
```

Override with the `CHART_URL` environment variable:

```bash
CHART_URL="oci://my-registry/rhdh-chart"
```

## Version Selection

Set the RHDH version:

```typescript
await rhdh.configure({
  method: "helm",
  version: "1.5",
});
```

Or via environment variable:

```bash
RHDH_VERSION="1.5"
```

## What Happens During Helm Deployment

1. **Namespace Creation**: Creates the Kubernetes namespace
2. **ConfigMaps**: Applies merged configuration:
   - `app-config-rhdh` - Application configuration
   - `dynamic-plugins` - Plugin configuration
3. **Secrets**: Applies secrets with env substitution:
   - `rhdh-secrets` - Application secrets
4. **Helm Install**: Runs `helm upgrade --install`:
   ```bash
   helm upgrade --install backstage oci://quay.io/rhdh/chart \
     --version ${RHDH_VERSION} \
     --namespace ${NAMESPACE} \
     --values ${VALUE_FILE}
   ```
5. **Wait for Ready**: Waits for the deployment to be ready

## Full Example

### File Structure

```
e2e-tests/
├── playwright.config.ts
├── .env
└── tests/
    ├── config/
    │   ├── app-config-rhdh.yaml
    │   ├── dynamic-plugins.yaml
    │   ├── rhdh-secrets.yaml
    │   └── value_file.yaml
    └── specs/
        └── my-plugin.spec.ts
```

### `.env`

```bash
RHDH_VERSION="1.5"
INSTALLATION_METHOD="helm"
GITHUB_TOKEN=ghp_xxxxx
```

### `tests/config/value_file.yaml`

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

    extraEnvVarsSecrets:
      - rhdh-secrets

  postgresql:
    enabled: true
```

### `tests/config/app-config-rhdh.yaml`

```yaml
app:
  title: My Plugin Test Instance

backend:
  baseUrl: https://backstage-${NAMESPACE}.${K8S_CLUSTER_ROUTER_BASE}
  cors:
    origin: https://backstage-${NAMESPACE}.${K8S_CLUSTER_ROUTER_BASE}

# Plugin configuration
myPlugin:
  enabled: true
```

### `tests/config/dynamic-plugins.yaml`

```yaml
includes:
  - dynamic-plugins.default.yaml

plugins:
  - package: ./dynamic-plugins/dist/my-plugin
    disabled: false
```

### `tests/config/rhdh-secrets.yaml`

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: rhdh-secrets
type: Opaque
stringData:
  GITHUB_TOKEN: ${GITHUB_TOKEN}
```

### Test File

```typescript
import { test, expect } from "rhdh-e2e-test-utils/test";

test.beforeAll(async ({ rhdh }) => {
  await rhdh.configure({
    method: "helm",
    auth: "keycloak",
    appConfig: "tests/config/app-config-rhdh.yaml",
    secrets: "tests/config/rhdh-secrets.yaml",
    dynamicPlugins: "tests/config/dynamic-plugins.yaml",
    valueFile: "tests/config/value_file.yaml",
  });

  await rhdh.deploy();
});

test("verify deployment", async ({ page, rhdh }) => {
  await page.goto(rhdh.rhdhUrl);
  await expect(page).toHaveTitle(/Red Hat Developer Hub/);
});
```

## Troubleshooting

### Chart Not Found

```
Error: chart "rhdh" not found
```

**Solution**: Verify the chart URL and version are correct:

```bash
helm show chart oci://quay.io/rhdh/chart --version 1.5
```

### Image Pull Errors

```
Error: ImagePullBackOff
```

**Solution**: Check the image registry and tag in your values file.

### PVC Pending

```
Error: PersistentVolumeClaim is pending
```

**Solution**: Ensure your cluster has a default StorageClass or specify one in the values file.
