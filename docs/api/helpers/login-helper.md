# LoginHelper API

Authentication helper for various providers.

## Import

```typescript
import { LoginHelper } from "rhdh-e2e-test-utils/helpers";
```

## Constructor

```typescript
new LoginHelper(page: Page)
```

## Methods

### `loginAsGuest()`

```typescript
async loginAsGuest(): Promise<void>
```

Login using guest authentication.

### `loginAsKeycloakUser()`

```typescript
async loginAsKeycloakUser(username?: string, password?: string): Promise<void>
```

Login using Keycloak OIDC.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `username` | `string` | `process.env.KEYCLOAK_USER_NAME` or `"test1"` | Username |
| `password` | `string` | `process.env.KEYCLOAK_USER_PASSWORD` or `"test1@123"` | Password |

### `loginAsGithubUser()`

```typescript
async loginAsGithubUser(): Promise<void>
```

Login using GitHub OAuth.

**Required environment variables:**
- `GH_USER_NAME`
- `GH_USER_PASSWORD`
- `GH_2FA_SECRET`

### `signOut()`

```typescript
async signOut(): Promise<void>
```

Sign out of RHDH.

## Example

```typescript
import { test } from "rhdh-e2e-test-utils/test";

test.beforeEach(async ({ loginHelper }) => {
  await loginHelper.loginAsKeycloakUser();
});

test("logged in test", async ({ page }) => {
  // Already authenticated
});

test.afterEach(async ({ loginHelper }) => {
  await loginHelper.signOut();
});
```
