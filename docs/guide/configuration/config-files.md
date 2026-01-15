# Configuration Files

RHDH deployment uses YAML configuration files for app config, plugins, and secrets.

## File Structure

Create configuration files in `tests/config/`:

```
tests/config/
├── app-config-rhdh.yaml    # Application configuration
├── dynamic-plugins.yaml    # Plugin configuration
├── rhdh-secrets.yaml       # Secrets with env placeholders
└── value_file.yaml         # Helm values (optional)
```

## app-config-rhdh.yaml

Application configuration for RHDH:

```yaml
app:
  title: My Plugin Test Instance
  baseUrl: https://backstage-${NAMESPACE}.${K8S_CLUSTER_ROUTER_BASE}

backend:
  baseUrl: https://backstage-${NAMESPACE}.${K8S_CLUSTER_ROUTER_BASE}
  cors:
    origin: https://backstage-${NAMESPACE}.${K8S_CLUSTER_ROUTER_BASE}
  reading:
    allow:
      - host: "*.example.com"

# Plugin-specific configuration
techRadar:
  url: "http://${DATA_SOURCE_URL}/tech-radar"

catalog:
  rules:
    - allow: [Component, API, Template, System, Domain, Group, User]
```

## dynamic-plugins.yaml

Configure dynamic plugins:

```yaml
includes:
  - dynamic-plugins.default.yaml

plugins:
  # Enable your plugin
  - package: ./dynamic-plugins/dist/my-frontend-plugin
    disabled: false
    pluginConfig:
      dynamicPlugins:
        frontend:
          my-frontend-plugin:
            mountPoints:
              - mountPoint: entity.page.overview/cards
                importName: MyPluginCard
                config:
                  layout:
                    gridColumnEnd: span 4

  # Backend plugin
  - package: ./dynamic-plugins/dist/my-backend-plugin-dynamic
    disabled: false

  # Disable default plugins if needed
  - package: ./dynamic-plugins/dist/some-default-plugin
    disabled: true
```

## rhdh-secrets.yaml

Secrets with environment variable substitution:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: rhdh-secrets
type: Opaque
stringData:
  # GitHub integration
  GITHUB_TOKEN: ${GITHUB_TOKEN}

  # Custom API keys
  MY_API_KEY: ${MY_API_KEY:-default-key}

  # Backend auth
  BACKEND_SECRET: ${BACKEND_SECRET}
```

Environment variables are substituted at deployment time.

## value_file.yaml (Helm)

Helm values for RHDH chart:

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
    auth:
      secretKeys:
        adminPasswordKey: postgres-password
        userPasswordKey: password
```

## Configuration Merging Order

When you deploy RHDH, configurations are merged:

```
1. Package: config/common/app-config-rhdh.yaml
2. Package: config/auth/{provider}/app-config.yaml
3. Project: tests/config/app-config-rhdh.yaml
```

Later files override earlier files. You only need to specify what's different from defaults.

## Environment Variable Substitution

Use these syntaxes in YAML files:

| Syntax | Description |
|--------|-------------|
| `$VAR` | Simple substitution |
| `${VAR}` | Braced substitution |
| `${VAR:-default}` | Default if unset |

Example:
```yaml
backend:
  baseUrl: https://backstage-${NAMESPACE}.${K8S_CLUSTER_ROUTER_BASE}
  database:
    client: pg
    connection:
      port: ${DB_PORT:-5432}
```

## Best Practices

1. **Use environment variables** for secrets and dynamic values
2. **Keep configs minimal** - only override what's needed
3. **Use default values** for optional settings
4. **Separate concerns** - app config, plugins, secrets in different files
5. **Version control** configs but not secrets
