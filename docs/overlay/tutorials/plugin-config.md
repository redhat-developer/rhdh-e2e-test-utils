# Plugin Configuration

::: tip Overlay Documentation
This page covers writing tests within rhdh-plugin-export-overlays.
For using rhdh-e2e-test-utils in external projects, see the [Guide](/guide/).
:::

This tutorial explains how to configure plugin-specific settings for your E2E tests.

## Configuration Files Overview

Plugin configuration is done through YAML files in `tests/config/`:

| File | Purpose |
|------|---------|
| `app-config-rhdh.yaml` | RHDH application configuration |
| `rhdh-secrets.yaml` | Kubernetes secrets for sensitive values |
| `dynamic-plugins.yaml` | Dynamic plugin settings (optional) |

## Configuring app-config-rhdh.yaml

### Basic Structure

```yaml
# Plugin-specific RHDH configuration
app:
  title: RHDH <Plugin> Test Instance

# Plugin configuration section
<pluginName>:
  setting1: value1
  setting2: value2
```

### Allowing External Hosts

If your plugin needs to read from external URLs:

```yaml
backend:
  reading:
    allow:
      - host: api.example.com
      - host: ${DYNAMIC_HOST}
```

### Using Environment Variables

Use `${VAR_NAME}` syntax for dynamic values:

```yaml
techRadar:
  url: "http://${TECH_RADAR_DATA_URL}/tech-radar"
```

### Complete Example

```yaml
# rhdh app config file
# This file merges with defaults from rhdh-e2e-test-utils

app:
  title: RHDH Tech Radar Test Instance

backend:
  reading:
    allow:
      - host: ${TECH_RADAR_DATA_URL}

techRadar:
  url: "http://${TECH_RADAR_DATA_URL}/tech-radar"
```

## Configuring Secrets

### When Is rhdh-secrets.yaml Needed?

| Where you need the variable | rhdh-secrets.yaml required? |
|-----------------------------|----------------------------|
| Test code (`*.spec.ts`) via `process.env` | No - access directly |
| `app-config-rhdh.yaml` | Yes |
| `dynamic-plugins.yaml` | Yes |

::: tip
If you only need a secret in your test code, just use `process.env.VAULT_*` directly.
:::

### How Secrets Work (for RHDH configs)

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│ Vault / .env    │────▶│ rhdh-secrets.yaml│────▶│ app-config-rhdh.yaml│
│ VAULT_MY_SECRET │     │ MY_SECRET: $VAR  │     │ ${MY_SECRET}        │
│                 │     │ (substituted)    │     │ (references secret) │
└─────────────────┘     └──────────────────┘     └─────────────────────┘
```

### Secret File Structure

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: rhdh-secrets
type: Opaque
stringData:
  # Left side: name to use in app-config (with ${...})
  # Right side: reference to env var from Vault/.env (with $)
  SECRET_NAME: $VAULT_SECRET_NAME
```

### Example

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: rhdh-secrets
type: Opaque
stringData:
  TECH_RADAR_DATA_URL: $VAULT_TECH_RADAR_DATA_URL
  GITHUB_TOKEN: $VAULT_GITHUB_TOKEN
```

Then in `app-config-rhdh.yaml`:
```yaml
techRadar:
  url: "http://${TECH_RADAR_DATA_URL}/tech-radar"
```

## Setting Environment Variables

### In Test Code

Set variables dynamically in your test setup:

```typescript
test.beforeAll(async ({ rhdh }) => {
  const project = rhdh.deploymentConfig.namespace;

  // Configure RHDH first
  await rhdh.configure({ auth: "keycloak" });

  // Deploy external service
  await $`bash ${setupScript} ${project}`;

  // Get URL and set as env var
  const serviceUrl = await rhdh.k8sClient.getRouteLocation(
    project,
    "my-service",
  );
  process.env.MY_SERVICE_URL = serviceUrl.replace("http://", "");

  // Deploy RHDH
  await rhdh.deploy();
});
```

### In .env File

For local development, set in `.env`:

```bash
TECH_RADAR_DATA_URL=my-service.apps.cluster.example.com
GITHUB_TOKEN=ghp_xxxxxxxxxxxx
```

### In Vault (CI)

Add secrets to Vault with `VAULT_` prefix. They are automatically exported during OpenShift CI execution:

```
VAULT_TECH_RADAR_DATA_URL: my-service.apps.cluster.example.com
VAULT_GITHUB_TOKEN: ghp_xxxxxxxxxxxx
```

Then reference in `rhdh-secrets.yaml`:
```yaml
stringData:
  TECH_RADAR_DATA_URL: $VAULT_TECH_RADAR_DATA_URL
```

## Dynamic Plugins Configuration

### When to Use

Use `dynamic-plugins.yaml` when:
- Plugin requires explicit dynamic plugin configuration
- Overriding default plugin settings
- Plugin doesn't use metadata-based configuration

### Structure

```yaml
plugins:
  - package: "@company/backstage-plugin-example"
    disabled: false
    pluginConfig:
      example:
        setting: value
```

### Example

```yaml
plugins:
  - package: "@backstage-community/plugin-tech-radar"
    disabled: false
    pluginConfig:
      techRadar:
        url: "http://${TECH_RADAR_DATA_URL}/tech-radar"
```

## Configuration Merging

Your configuration files are merged with defaults in this order:

1. `rhdh-e2e-test-utils/config/common/` - Base defaults
2. `rhdh-e2e-test-utils/config/auth/{guest,keycloak}/` - Auth-specific
3. `rhdh-e2e-test-utils/config/{helm,operator}/` - Deployment method
4. Your `tests/config/` files - Your customizations

Later files override earlier ones.

## Common Configuration Patterns

### Catalog Configuration

```yaml
catalog:
  locations:
    - type: url
      target: https://github.com/org/repo/blob/main/catalog-info.yaml
```

### Auth Provider Configuration

```yaml
auth:
  providers:
    github:
      clientId: ${GITHUB_CLIENT_ID}
      clientSecret: ${GITHUB_CLIENT_SECRET}
```

### Proxy Configuration

```yaml
proxy:
  endpoints:
    "/my-api":
      target: https://api.example.com
      headers:
        Authorization: Bearer ${API_TOKEN}
```

## Debugging Configuration

### Check Merged Config

Enable debug logging to see the merged configuration:

```typescript
test.beforeAll(async ({ rhdh }) => {
  await rhdh.configure({ auth: "keycloak" });

  // Log the final config
  console.log("Deployment config:", rhdh.deploymentConfig);

  await rhdh.deploy();
});
```

### Verify Environment Variables

```typescript
test.beforeAll(async ({ rhdh }) => {
  console.log("TECH_RADAR_DATA_URL:", process.env.TECH_RADAR_DATA_URL);

  await rhdh.configure({ auth: "keycloak" });
  await rhdh.deploy();
});
```

## Related Pages

- [Configuration Files](/overlay/test-structure/configuration-files) - Detailed reference
- [Environment Variables](/overlay/reference/environment-variables) - All variables
- [Pre-requisite Services](./custom-deployment) - Deploy dependencies before RHDH
