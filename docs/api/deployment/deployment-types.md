# Deployment Types

Type definitions for RHDH deployment configuration.

## Import

```typescript
import type {
  DeploymentMethod,
  AuthProvider,
  DeploymentOptions,
  DeploymentConfig,
} from "rhdh-e2e-test-utils/rhdh";
```

## DeploymentMethod

```typescript
type DeploymentMethod = "helm" | "operator";
```

Installation method for RHDH.

## AuthProvider

```typescript
type AuthProvider = "guest" | "keycloak";
```

Authentication provider configuration.

## DeploymentOptions

```typescript
type DeploymentOptions = {
  version?: string;
  namespace?: string;
  auth?: AuthProvider;
  appConfig?: string;
  secrets?: string;
  dynamicPlugins?: string;
  method?: DeploymentMethod;
  valueFile?: string;
  subscription?: string;
};
```

| Property | Type | Description |
|----------|------|-------------|
| `version` | `string` | RHDH version (e.g., "1.5") |
| `namespace` | `string` | Kubernetes namespace |
| `auth` | `AuthProvider` | Authentication provider |
| `appConfig` | `string` | Path to app-config YAML |
| `secrets` | `string` | Path to secrets YAML |
| `dynamicPlugins` | `string` | Path to plugins YAML |
| `method` | `DeploymentMethod` | Installation method |
| `valueFile` | `string` | Helm values file (Helm only) |
| `subscription` | `string` | Backstage CR file (Operator only) |

## DeploymentConfigBase

```typescript
type DeploymentConfigBase = {
  version: string;
  namespace: string;
  auth: AuthProvider;
  appConfig: string;
  secrets: string;
  dynamicPlugins: string;
};
```

## HelmDeploymentConfig

```typescript
type HelmDeploymentConfig = {
  method: "helm";
  valueFile: string;
};
```

## OperatorDeploymentConfig

```typescript
type OperatorDeploymentConfig = {
  method: "operator";
  subscription: string;
};
```

## DeploymentConfig

```typescript
type DeploymentConfig = DeploymentConfigBase &
  (HelmDeploymentConfig | OperatorDeploymentConfig);
```

Combined type for full deployment configuration.

## Example Usage

```typescript
import { RHDHDeployment } from "rhdh-e2e-test-utils/rhdh";
import type { DeploymentOptions } from "rhdh-e2e-test-utils/rhdh";

const options: DeploymentOptions = {
  version: "1.5",
  method: "helm",
  auth: "keycloak",
};

const rhdh = new RHDHDeployment("my-namespace");
await rhdh.configure(options);
await rhdh.deploy();

// Access typed config
const config = rhdh.deploymentConfig;
console.log(config.version);   // string
console.log(config.namespace); // string
console.log(config.auth);      // "guest" | "keycloak"
```
