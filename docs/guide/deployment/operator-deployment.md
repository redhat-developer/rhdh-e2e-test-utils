# Operator Deployment

Deploy RHDH using the RHDH Operator.

## Prerequisites

The RHDH Operator must be installed on your cluster. Install it via OperatorHub or the command line:

```bash
# Create operator namespace
oc create namespace rhdh-operator

# Install the operator
oc apply -f - <<EOF
apiVersion: operators.coreos.com/v1alpha1
kind: Subscription
metadata:
  name: rhdh-operator
  namespace: rhdh-operator
spec:
  channel: fast
  name: rhdh
  source: redhat-operators
  sourceNamespace: openshift-marketplace
EOF
```

## Configuration

Set the installation method to `operator`:

```typescript
await rhdh.configure({
  method: "operator",
  subscription: "tests/config/subscription.yaml",
});
```

Or via environment variable:

```bash
INSTALLATION_METHOD="operator"
```

## Backstage Custom Resource

Create a Backstage CR to define your RHDH instance.

### Example: `tests/config/subscription.yaml`

```yaml
apiVersion: rhdh.redhat.com/v1alpha3
kind: Backstage
metadata:
  name: backstage
spec:
  application:
    appConfig:
      configMaps:
        - name: app-config-rhdh
    dynamicPluginsConfigMapName: dynamic-plugins
    extraEnvs:
      secrets:
        - name: rhdh-secrets
    replicas: 1
    route:
      enabled: true
  database:
    enableLocalDb: true
```

## Version Selection

For operator deployments, the version is determined by the operator version installed on the cluster. The `version` option in deployment config is less relevant for operator deployments.

## What Happens During Operator Deployment

1. **Namespace Creation**: Creates the Kubernetes namespace
2. **ConfigMaps**: Applies merged configuration:
   - `app-config-rhdh` - Application configuration
   - `dynamic-plugins` - Plugin configuration
3. **Secrets**: Applies secrets with env substitution:
   - `rhdh-secrets` - Application secrets
4. **Backstage CR**: Applies the Backstage custom resource:
   ```bash
   oc apply -f subscription.yaml -n ${NAMESPACE}
   ```
5. **Wait for Ready**: Waits for the Backstage deployment to be ready

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
    │   └── subscription.yaml
    └── specs/
        └── my-plugin.spec.ts
```

### `.env`

```bash
INSTALLATION_METHOD="operator"
GITHUB_TOKEN=ghp_xxxxx
```

### `tests/config/subscription.yaml`

```yaml
apiVersion: rhdh.redhat.com/v1alpha3
kind: Backstage
metadata:
  name: backstage
spec:
  application:
    appConfig:
      configMaps:
        - name: app-config-rhdh
    dynamicPluginsConfigMapName: dynamic-plugins
    extraEnvs:
      secrets:
        - name: rhdh-secrets
      envs:
        - name: LOG_LEVEL
          value: debug
    replicas: 1
    route:
      enabled: true
  database:
    enableLocalDb: true
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
    method: "operator",
    auth: "keycloak",
    appConfig: "tests/config/app-config-rhdh.yaml",
    secrets: "tests/config/rhdh-secrets.yaml",
    dynamicPlugins: "tests/config/dynamic-plugins.yaml",
    subscription: "tests/config/subscription.yaml",
  });

  await rhdh.deploy();
});

test("verify deployment", async ({ page, rhdh }) => {
  await page.goto(rhdh.rhdhUrl);
  await expect(page).toHaveTitle(/Red Hat Developer Hub/);
});
```

## Operator vs Helm

| Aspect | Operator | Helm |
|--------|----------|------|
| Installation | Requires operator on cluster | Just Helm CLI |
| Upgrades | Managed by operator | Manual helm upgrade |
| Configuration | Backstage CR | Helm values |
| Complexity | More setup, less maintenance | Less setup, more maintenance |

## Troubleshooting

### Operator Not Installed

```
Error: no matches for kind "Backstage"
```

**Solution**: Install the RHDH Operator on your cluster.

### CR Validation Failed

```
Error: admission webhook denied the request
```

**Solution**: Check the Backstage CR spec matches the operator's expected schema.

### Deployment Not Ready

```
Error: Backstage deployment timed out
```

**Solution**: Check the operator logs and Backstage pod logs:

```bash
oc logs -n rhdh-operator deployment/rhdh-operator
oc logs -n ${NAMESPACE} deployment/backstage
```
