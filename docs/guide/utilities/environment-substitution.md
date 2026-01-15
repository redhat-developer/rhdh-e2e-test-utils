# Environment Substitution

The `envsubst` function replaces environment variable placeholders in strings.

## Usage

```typescript
import { envsubst } from "rhdh-e2e-test-utils/utils";
```

## Basic Substitution

```typescript
// Simple variable
process.env.API_URL = "https://api.example.com";
const result = envsubst("URL: $API_URL");
// Result: "URL: https://api.example.com"

// With braces
const result2 = envsubst("URL: ${API_URL}");
// Result: "URL: https://api.example.com"
```

## Default Values

Use `:-` syntax for default values:

```typescript
// If PORT is not set, use 8080
const result = envsubst("Port: ${PORT:-8080}");
// Result: "Port: 8080"

// If PORT is set
process.env.PORT = "3000";
const result2 = envsubst("Port: ${PORT:-8080}");
// Result: "Port: 3000"
```

## YAML Configuration

Common use case is processing YAML configuration files:

```yaml
# config-template.yaml
app:
  title: ${APP_TITLE:-My App}
  baseUrl: https://${HOST}.${DOMAIN}

backend:
  cors:
    origin: ${CORS_ORIGIN:-*}
```

```typescript
import { envsubst } from "rhdh-e2e-test-utils/utils";
import * as fs from "fs";

const template = fs.readFileSync("config-template.yaml", "utf-8");
const config = envsubst(template);
fs.writeFileSync("config.yaml", config);
```

## Secrets Processing

The package uses `envsubst` internally for secrets:

```yaml
# rhdh-secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: rhdh-secrets
type: Opaque
stringData:
  GITHUB_TOKEN: ${GITHUB_TOKEN}
  API_KEY: ${API_KEY:-default-key}
```

When deployed, environment variables are substituted automatically.

## Complete Example

```typescript
import { test } from "rhdh-e2e-test-utils/test";
import { envsubst } from "rhdh-e2e-test-utils/utils";

test.beforeAll(async ({ rhdh }) => {
  // Set environment variables
  process.env.CUSTOM_API_URL = "https://custom.example.com";
  process.env.NAMESPACE = rhdh.deploymentConfig.namespace;

  // Template with variables
  const template = `
    backend:
      baseUrl: https://backstage-\${NAMESPACE}.\${K8S_CLUSTER_ROUTER_BASE}
    custom:
      apiUrl: \${CUSTOM_API_URL}
  `;

  // Substitute variables
  const config = envsubst(template);
  console.log(config);

  await rhdh.configure({ auth: "keycloak" });
  await rhdh.deploy();
});
```

## Supported Syntax

| Syntax | Description |
|--------|-------------|
| `$VAR` | Simple substitution |
| `${VAR}` | Braced substitution |
| `${VAR:-default}` | Default if unset or empty |
