# Authentication Providers

The package supports modular authentication configuration, allowing you to switch between providers with a single option.

## Available Providers

| Provider | Description | Use Case |
|----------|-------------|----------|
| `guest` | Simple guest authentication | Development, simple tests |
| `keycloak` | OIDC via Keycloak | Production-like auth testing |

## Guest Authentication

Guest authentication allows users to enter without credentials, using a simple "Enter as Guest" button.

### Configuration

```typescript
await rhdh.configure({ auth: "guest" });
await rhdh.deploy();
```

### Usage in Tests

```typescript
test.beforeEach(async ({ loginHelper }) => {
  await loginHelper.loginAsGuest();
});
```

### When to Use Guest Auth

- Quick development testing
- Tests that don't require user identity
- Simplified CI/CD pipelines
- Tests focused on UI behavior, not auth

### Skipping Keycloak Deployment

When using guest auth, skip Keycloak deployment:

```bash
SKIP_KEYCLOAK_DEPLOYMENT=true yarn playwright test
```

## Keycloak Authentication

Keycloak provides OIDC authentication for realistic auth testing.

### Configuration

```typescript
await rhdh.configure({ auth: "keycloak" });
await rhdh.deploy();
```

### Prerequisites

Keycloak must be deployed and configured. This happens automatically via global setup unless skipped.

### Usage in Tests

```typescript
test.beforeEach(async ({ loginHelper }) => {
  // Use default test user (test1/test1@123)
  await loginHelper.loginAsKeycloakUser();

  // Or specify credentials
  await loginHelper.loginAsKeycloakUser("test1", "test1@123");
});
```

### Default Keycloak Users

<!--@include: @/snippets/keycloak-credentials.md-->

For more details, see [Keycloak Deployment](./keycloak-deployment.md#default-configuration).

### Creating Custom Users

```typescript
import { KeycloakHelper } from "rhdh-e2e-test-utils/keycloak";

test.beforeAll(async ({ rhdh }) => {
  const keycloak = new KeycloakHelper();

  // Connect to existing Keycloak
  await keycloak.connect({
    baseUrl: process.env.KEYCLOAK_BASE_URL!,
    username: "admin",
    password: "admin123",
  });

  // Create custom users
  await keycloak.createUser("rhdh", {
    username: "admin-user",
    password: "adminpass",
    groups: ["admins"],
  });

  await keycloak.createUser("rhdh", {
    username: "viewer-user",
    password: "viewerpass",
    groups: ["viewers"],
  });

  await rhdh.configure({ auth: "keycloak" });
  await rhdh.deploy();
});
```

### When to Use Keycloak Auth

- Testing role-based access control
- Testing user-specific features
- Production-like testing scenarios
- Testing logout/session flows

## Environment Variables

### Guest Auth

No additional environment variables required.

### Keycloak Auth

These are automatically set by `KeycloakHelper.configureForRHDH()`:

| Variable | Description |
|----------|-------------|
| `KEYCLOAK_BASE_URL` | Keycloak instance URL |
| `KEYCLOAK_REALM` | Realm name |
| `KEYCLOAK_CLIENT_ID` | OIDC client ID |
| `KEYCLOAK_CLIENT_SECRET` | OIDC client secret |
| `KEYCLOAK_METADATA_URL` | OIDC discovery URL |
| `KEYCLOAK_LOGIN_REALM` | Login realm name |

## Configuration Merging

When you set `auth: "guest"` or `auth: "keycloak"`, the package automatically includes auth-specific configurations:

```
Package configs:
├── common/                    # Always applied
│   ├── app-config-rhdh.yaml
│   ├── dynamic-plugins.yaml
│   └── rhdh-secrets.yaml
└── auth/
    ├── guest/                 # Applied when auth: "guest"
    │   └── app-config.yaml
    └── keycloak/              # Applied when auth: "keycloak"
        ├── app-config.yaml
        ├── dynamic-plugins.yaml
        └── secrets.yaml
```

Your project configs are merged on top, so you only need to override what's different.

## GitHub Authentication

GitHub authentication is available via `LoginHelper`:

```typescript
// Requires environment variables:
// GH_USER_NAME, GH_USER_PASSWORD, GH_2FA_SECRET

test.beforeEach(async ({ loginHelper }) => {
  await loginHelper.loginAsGithubUser();
});
```

::: warning
GitHub authentication requires 2FA secret for automated logins. This is more complex to set up than guest or Keycloak auth.
:::

## Switching Auth Providers

### In Different Test Files

```typescript
// guest-tests.spec.ts
test.beforeAll(async ({ rhdh }) => {
  await rhdh.configure({ auth: "guest" });
  await rhdh.deploy();
});

// keycloak-tests.spec.ts
test.beforeAll(async ({ rhdh }) => {
  await rhdh.configure({ auth: "keycloak" });
  await rhdh.deploy();
});
```

### In Different Projects

```typescript
// playwright.config.ts
export default defineConfig({
  projects: [
    {
      name: "guest-tests",
      testMatch: "**/guest-*.spec.ts",
    },
    {
      name: "keycloak-tests",
      testMatch: "**/keycloak-*.spec.ts",
    },
  ],
});
```

Each project gets its own namespace and deployment with different auth.

## Best Practices

1. **Use guest auth for speed** - Faster to set up and run
2. **Use Keycloak for RBAC testing** - When you need user roles
3. **Create test users per test suite** - Avoid shared state
4. **Clean up custom users** - Remove users created during tests
5. **Use environment variables** - Don't hardcode credentials
