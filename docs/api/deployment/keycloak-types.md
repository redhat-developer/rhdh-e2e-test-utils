# Keycloak Types

Type definitions for Keycloak configuration.

## Import

```typescript
import type {
  KeycloakDeploymentOptions,
  KeycloakDeploymentConfig,
  KeycloakClientConfig,
  KeycloakUserConfig,
  KeycloakGroupConfig,
  KeycloakRealmConfig,
  KeycloakConnectionConfig,
} from "rhdh-e2e-test-utils/keycloak";
```

## KeycloakDeploymentOptions

```typescript
type KeycloakDeploymentOptions = {
  namespace?: string;
  releaseName?: string;
  valuesFile?: string;
  adminUser?: string;
  adminPassword?: string;
};
```

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `namespace` | `string` | `"rhdh-keycloak"` | Kubernetes namespace |
| `releaseName` | `string` | `"keycloak"` | Helm release name |
| `valuesFile` | `string` | - | Custom Helm values |
| `adminUser` | `string` | `"admin"` | Admin username |
| `adminPassword` | `string` | `"admin123"` | Admin password |

## KeycloakDeploymentConfig

```typescript
type KeycloakDeploymentConfig = {
  namespace: string;
  releaseName: string;
  valuesFile: string;
  adminUser: string;
  adminPassword: string;
};
```

## KeycloakClientConfig

```typescript
type KeycloakClientConfig = {
  clientId: string;
  clientSecret: string;
  name?: string;
  description?: string;
  redirectUris?: string[];
  webOrigins?: string[];
  standardFlowEnabled?: boolean;
  implicitFlowEnabled?: boolean;
  directAccessGrantsEnabled?: boolean;
  serviceAccountsEnabled?: boolean;
  authorizationServicesEnabled?: boolean;
  publicClient?: boolean;
  attributes?: Record<string, string>;
  defaultClientScopes?: string[];
  optionalClientScopes?: string[];
};
```

## KeycloakUserConfig

```typescript
type KeycloakUserConfig = {
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  enabled?: boolean;
  emailVerified?: boolean;
  password?: string;
  temporary?: boolean;
  groups?: string[];
};
```

## KeycloakGroupConfig

```typescript
type KeycloakGroupConfig = {
  name: string;
};
```

## KeycloakRealmConfig

```typescript
type KeycloakRealmConfig = {
  realm: string;
  displayName?: string;
  enabled?: boolean;
};
```

## KeycloakConnectionConfig

```typescript
type KeycloakConnectionConfig = {
  baseUrl: string;
  realm?: string;
  clientId?: string;
  clientSecret?: string;
  username?: string;
  password?: string;
};
```

Connect with admin credentials:
```typescript
await keycloak.connect({
  baseUrl: "https://keycloak.example.com",
  username: "admin",
  password: "admin-password",
});
```

Connect with client credentials:
```typescript
await keycloak.connect({
  baseUrl: "https://keycloak.example.com",
  realm: "master",
  clientId: "admin-client",
  clientSecret: "client-secret",
});
```

## Example Usage

```typescript
import { KeycloakHelper } from "rhdh-e2e-test-utils/keycloak";
import type { KeycloakUserConfig } from "rhdh-e2e-test-utils/keycloak";

const keycloak = new KeycloakHelper();
await keycloak.deploy();
await keycloak.configureForRHDH();

const user: KeycloakUserConfig = {
  username: "test-user",
  email: "test@example.com",
  firstName: "Test",
  lastName: "User",
  password: "password123",
  groups: ["developers"],
};

await keycloak.createUser("rhdh", user);
```
