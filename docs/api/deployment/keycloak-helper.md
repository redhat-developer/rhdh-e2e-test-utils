# KeycloakHelper

Class for deploying and managing Keycloak in OpenShift.

## Import

```typescript
import { KeycloakHelper } from "rhdh-e2e-test-utils/keycloak";
```

## Constructor

```typescript
new KeycloakHelper(options?: KeycloakDeploymentOptions)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `options` | `KeycloakDeploymentOptions` | Optional deployment configuration |

## Properties

### `keycloakUrl`

```typescript
get keycloakUrl(): string
```

The URL of the Keycloak instance.

### `realm`

```typescript
get realm(): string
```

Configured realm name.

### `clientId`

```typescript
get clientId(): string
```

Configured OIDC client ID.

### `clientSecret`

```typescript
get clientSecret(): string
```

Configured OIDC client secret.

### `deploymentConfig`

```typescript
get deploymentConfig(): KeycloakDeploymentConfig
```

Current deployment configuration.

### `k8sClient`

```typescript
get k8sClient(): KubernetesClientHelper
```

Kubernetes client instance.

## Methods

### `deploy()`

```typescript
async deploy(): Promise<void>
```

Deploy Keycloak using Bitnami Helm chart.

### `configureForRHDH()`

```typescript
async configureForRHDH(options?: object): Promise<void>
```

Configure realm, client, groups, and users for RHDH.

### `isRunning()`

```typescript
async isRunning(): Promise<boolean>
```

Check if Keycloak is accessible.

### `connect()`

```typescript
async connect(config: KeycloakConnectionConfig): Promise<void>
```

Connect to an existing Keycloak instance.

### `createRealm()`

```typescript
async createRealm(config: KeycloakRealmConfig): Promise<void>
```

Create a new realm.

### `createClient()`

```typescript
async createClient(realm: string, config: KeycloakClientConfig): Promise<void>
```

Create a client in a realm.

### `createGroup()`

```typescript
async createGroup(realm: string, config: KeycloakGroupConfig): Promise<void>
```

Create a group in a realm.

### `createUser()`

```typescript
async createUser(realm: string, config: KeycloakUserConfig): Promise<void>
```

Create a user with optional group membership.

### `getUsers()`

```typescript
async getUsers(realm: string): Promise<UserRepresentation[]>
```

Get all users in a realm.

### `getGroups()`

```typescript
async getGroups(realm: string): Promise<GroupRepresentation[]>
```

Get all groups in a realm.

### `deleteUser()`

```typescript
async deleteUser(realm: string, username: string): Promise<void>
```

Delete a user.

### `deleteGroup()`

```typescript
async deleteGroup(realm: string, groupName: string): Promise<void>
```

Delete a group.

### `deleteRealm()`

```typescript
async deleteRealm(realm: string): Promise<void>
```

Delete a realm.

### `teardown()`

```typescript
async teardown(): Promise<void>
```

Delete the Keycloak namespace.

### `waitUntilReady()`

```typescript
async waitUntilReady(timeout?: number): Promise<void>
```

Wait for Keycloak StatefulSet to be ready.

## Example

```typescript
import { KeycloakHelper } from "rhdh-e2e-test-utils/keycloak";

const keycloak = new KeycloakHelper({
  namespace: "rhdh-keycloak",
  adminUser: "admin",
  adminPassword: "admin123",
});

await keycloak.deploy();
await keycloak.configureForRHDH();

// Create custom user
await keycloak.createUser("rhdh", {
  username: "custom-user",
  password: "password123",
  groups: ["developers"],
});

console.log(`Keycloak URL: ${keycloak.keycloakUrl}`);
console.log(`Realm: ${keycloak.realm}`);
console.log(`Client ID: ${keycloak.clientId}`);
```
