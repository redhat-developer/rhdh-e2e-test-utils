# Keycloak Deployment

The `KeycloakHelper` class provides Keycloak deployment and management capabilities for OIDC authentication testing.

## Basic Usage

```typescript
import { KeycloakHelper } from "rhdh-e2e-test-utils/keycloak";

const keycloak = new KeycloakHelper({
  namespace: "rhdh-keycloak",
});

// Deploy Keycloak
await keycloak.deploy();

// Configure for RHDH
await keycloak.configureForRHDH();

// Access configuration
console.log(`Keycloak URL: ${keycloak.keycloakUrl}`);
console.log(`Realm: ${keycloak.realm}`);
console.log(`Client ID: ${keycloak.clientId}`);
```

## Automatic Deployment via Global Setup

When using the default Playwright configuration, Keycloak is automatically deployed in global setup:

- Namespace: `rhdh-keycloak`
- Realm: `rhdh`
- Client: `rhdh-client`
- Users: `test1`, `test2`

To skip automatic deployment:

```bash
SKIP_KEYCLOAK_DEPLOYMENT=true yarn playwright test
```

## Deployment Options

```typescript
type KeycloakDeploymentOptions = {
  namespace?: string;       // Default: "rhdh-keycloak"
  releaseName?: string;     // Default: "keycloak"
  valuesFile?: string;      // Custom Helm values file
  adminUser?: string;       // Default: "admin"
  adminPassword?: string;   // Default: "admin123"
};
```

### Example: Custom Configuration

```typescript
const keycloak = new KeycloakHelper({
  namespace: "my-keycloak",
  releaseName: "my-kc",
  adminUser: "admin",
  adminPassword: "mySecurePassword",
});
```

## Methods

### `deploy()`

Deploy Keycloak using the Bitnami Helm chart:

```typescript
await keycloak.deploy();
```

This:
1. Creates the namespace
2. Installs the Bitnami Keycloak Helm chart
3. Waits for the StatefulSet to be ready
4. Sets `keycloakUrl` property

### `configureForRHDH(options?)`

Configure Keycloak with realm, client, groups, and users for RHDH:

```typescript
// Use defaults
await keycloak.configureForRHDH();

// Custom configuration
await keycloak.configureForRHDH({
  realm: "my-realm",
  client: {
    clientId: "my-client",
    clientSecret: "my-secret",
  },
  groups: ["developers", "admins"],
  users: [
    { username: "user1", password: "pass1", groups: ["developers"] },
    { username: "user2", password: "pass2", groups: ["admins"] },
  ],
});
```

This also sets environment variables:
- `KEYCLOAK_BASE_URL`
- `KEYCLOAK_REALM`
- `KEYCLOAK_CLIENT_ID`
- `KEYCLOAK_CLIENT_SECRET`
- `KEYCLOAK_METADATA_URL`
- `KEYCLOAK_LOGIN_REALM`

### `isRunning()`

Check if Keycloak is accessible:

```typescript
const running = await keycloak.isRunning();
if (running) {
  console.log("Keycloak is ready");
}
```

### `connect(config)`

Connect to an existing Keycloak instance:

```typescript
// With admin credentials
await keycloak.connect({
  baseUrl: "https://keycloak.example.com",
  username: "admin",
  password: "admin-password",
});

// With client credentials
await keycloak.connect({
  baseUrl: "https://keycloak.example.com",
  realm: "master",
  clientId: "admin-client",
  clientSecret: "client-secret",
});
```

### User Management

```typescript
// Create user
await keycloak.createUser("rhdh", {
  username: "newuser",
  password: "password123",
  email: "user@example.com",
  groups: ["developers"],
});

// Get all users
const users = await keycloak.getUsers("rhdh");

// Delete user
await keycloak.deleteUser("rhdh", "username");
```

### Group Management

```typescript
// Create group
await keycloak.createGroup("rhdh", { name: "testers" });

// Get all groups
const groups = await keycloak.getGroups("rhdh");

// Delete group
await keycloak.deleteGroup("rhdh", "testers");
```

### Realm Management

```typescript
// Create realm
await keycloak.createRealm({
  realm: "new-realm",
  displayName: "New Realm",
  enabled: true,
});

// Delete realm
await keycloak.deleteRealm("new-realm");
```

### Client Management

```typescript
// Create client
await keycloak.createClient("rhdh", {
  clientId: "new-client",
  clientSecret: "client-secret",
  standardFlowEnabled: true,
  redirectUris: ["https://app.example.com/*"],
});
```

### `teardown()`

Delete the Keycloak namespace:

```typescript
await keycloak.teardown();
```

### `waitUntilReady(timeout?)`

Wait for Keycloak to be ready:

```typescript
await keycloak.waitUntilReady(300000); // 5 minutes
```

## Properties

| Property | Type | Description |
|----------|------|-------------|
| `keycloakUrl` | `string` | Keycloak instance URL |
| `realm` | `string` | Configured realm name |
| `clientId` | `string` | Configured client ID |
| `clientSecret` | `string` | Configured client secret |
| `deploymentConfig` | `KeycloakDeploymentConfig` | Current configuration |
| `k8sClient` | `KubernetesClientHelper` | Kubernetes client |

## Default Configuration

### Realm

| Setting | Value |
|---------|-------|
| Realm name | `rhdh` |

### Client (`rhdh-client`)

| Setting | Value |
|---------|-------|
| Client secret | `rhdh-client-secret` |
| Standard flow | Enabled |
| Implicit flow | Enabled |
| Direct access grants | Enabled |
| Service accounts | Enabled |
| Authorization services | Disabled |

### Groups

- `developers`
- `admins`
- `viewers`

### Users

<!--@include: @/snippets/keycloak-credentials.md-->

## Full Example: RHDH + Keycloak Setup

```typescript
import { test } from "rhdh-e2e-test-utils/test";
import { KeycloakHelper } from "rhdh-e2e-test-utils/keycloak";

let keycloak: KeycloakHelper;

test.beforeAll(async ({ rhdh }) => {
  // Deploy Keycloak (or connect to existing)
  keycloak = new KeycloakHelper({ namespace: "rhdh-keycloak" });

  if (!(await keycloak.isRunning())) {
    await keycloak.deploy();
  }

  await keycloak.configureForRHDH();

  // Create additional test users
  await keycloak.createUser("rhdh", {
    username: "admin-user",
    password: "admin123",
    groups: ["admins"],
  });

  // Deploy RHDH with Keycloak auth
  await rhdh.configure({ auth: "keycloak" });
  await rhdh.deploy();
});

test("login as admin", async ({ page, loginHelper }) => {
  await page.goto("/");
  await loginHelper.loginAsKeycloakUser("admin-user", "admin123");
  // ... assertions
});

test.afterAll(async () => {
  // Optional: cleanup
  await keycloak.deleteUser("rhdh", "admin-user");
});
```

## Related Pages

- [Authentication Providers](./authentication.md) - Overview of all auth providers
- [LoginHelper](../helpers/login-helper.md) - Login methods for tests
- [Keycloak OIDC Testing Tutorial](/tutorials/keycloak-oidc-testing.md) - Step-by-step guide
- [Keycloak Authentication Example](/examples/keycloak-auth-test.md) - Complete example
- [KeycloakHelper API Reference](/api/deployment/keycloak-helper.md) - Full API documentation
