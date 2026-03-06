# RbacApiHelper

The `RbacApiHelper` class provides utilities for managing RBAC (Role-Based Access Control) policies and roles in RHDH via the Permission API. It is primarily used in test teardown (`afterAll`) to clean up roles and policies created during a test run.

## Importing

```typescript
import { RbacApiHelper, Policy } from "@red-hat-developer-hub/e2e-test-utils/helpers";
```

## Setup

`RbacApiHelper` uses an async static factory method (`build`) rather than a plain constructor. This is because it needs to create a Playwright `APIRequestContext` before it is usable.

It requires a Backstage identity token. Use [`AuthApiHelper.getToken()`](/guide/helpers/auth-api-helper) to obtain one after logging in.

```typescript
import { AuthApiHelper, RbacApiHelper } from "@red-hat-developer-hub/e2e-test-utils/helpers";

// Inside a test or beforeAll hook:
const authApiHelper = new AuthApiHelper(page);
const token = await authApiHelper.getToken();

const rbacApiHelper = await RbacApiHelper.build(token);
```

### Prerequisites

Set the `RHDH_BASE_URL` environment variable. `RbacApiHelper` constructs its API URL as:

```
${RHDH_BASE_URL}/api/permission/
```

## Types

### `Policy`

Represents a single RBAC policy entry:

```typescript
interface Policy {
  entityReference: string; // e.g. "role:default/my-role"
  permission: string;       // e.g. "catalog.entity.read"
  policy: string;           // e.g. "allow" or "deny"
  effect: string;           // e.g. "allow" or "deny"
}
```

## Methods

### `RbacApiHelper.build(token)` (static)

Creates and returns a fully initialized `RbacApiHelper` instance.

```typescript
static async build(token: string): Promise<RbacApiHelper>
```

```typescript
const rbacApiHelper = await RbacApiHelper.build(token);
```

### `getPoliciesByRole(role)`

Fetches all policies associated with a role in the `default` namespace.

```typescript
async getPoliciesByRole(role: string): Promise<APIResponse>
```

```typescript
const response = await rbacApiHelper.getPoliciesByRole("my-role");
const policies = await response.json();
```

### `deleteRole(role)`

Deletes a role from the `default` namespace.

```typescript
async deleteRole(role: string): Promise<APIResponse>
```

```typescript
await rbacApiHelper.deleteRole("my-role");
```

### `deletePolicy(role, policies)`

Deletes specific policies for a role in the `default` namespace.

```typescript
async deletePolicy(role: string, policies: Policy[]): Promise<APIResponse>
```

**Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `role` | `string` | The role name in the `default` namespace |
| `policies` | `Policy[]` | Array of policy objects to delete |

```typescript
const policies: Policy[] = [
  {
    entityReference: "role:default/my-role",
    permission: "catalog.entity.read",
    policy: "allow",
    effect: "allow",
  },
];

await rbacApiHelper.deletePolicy("my-role", policies);
```

## `Response` Utility Class

The `rbac-api-helper` module also exports a `Response` utility class with a static helper for stripping metadata from API responses.

```typescript
import { Response } from "@red-hat-developer-hub/e2e-test-utils/helpers";
```

### `Response.removeMetadataFromResponse(response)`

Parses a Playwright `APIResponse`, validates it is an array, and strips the `metadata` field from each item. Useful when comparing policies without server-added metadata fields.

```typescript
static async removeMetadataFromResponse(
  response: APIResponse
): Promise<unknown[]>
```

```typescript
const apiResponse = await rbacApiHelper.getPoliciesByRole("my-role");
const policies = await Response.removeMetadataFromResponse(apiResponse);
// policies is now a clean array without metadata fields
```

## Complete Example

### Cleanup in afterAll

The primary use case for `RbacApiHelper` is ensuring that any roles and policies created during a test run are removed even if tests fail:

```typescript
import { test } from "@red-hat-developer-hub/e2e-test-utils/test";
import {
  AuthApiHelper,
  RbacApiHelper,
  Response,
  type Policy,
} from "@red-hat-developer-hub/e2e-test-utils/helpers";

test.describe("RBAC feature", () => {
  let rbacApiHelper: RbacApiHelper;
  const roleName = "test-role";

  test.beforeAll(async ({ page, loginHelper }) => {
    await page.goto("/");
    await loginHelper.loginAsKeycloakUser();

    const authApiHelper = new AuthApiHelper(page);
    const token = await authApiHelper.getToken();
    rbacApiHelper = await RbacApiHelper.build(token);
  });

  test.afterAll(async () => {
    // Clean up policies first, then the role
    const policiesResponse = await rbacApiHelper.getPoliciesByRole(roleName);

    if (policiesResponse.ok()) {
      const policies =
        (await Response.removeMetadataFromResponse(policiesResponse)) as Policy[];

      if (policies.length > 0) {
        await rbacApiHelper.deletePolicy(roleName, policies);
      }
    }

    await rbacApiHelper.deleteRole(roleName);
  });

  test("assign and verify role", async ({ page }) => {
    // test body...
  });
});
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `RHDH_BASE_URL` | Base URL of the RHDH instance (e.g. `https://rhdh.example.com`) |

## Related Pages

- [AuthApiHelper](/guide/helpers/auth-api-helper) — obtain the token required by `RbacApiHelper.build()`
- [APIHelper](/guide/helpers/api-helper) — catalog and GitHub API operations
- [LoginHelper](/guide/helpers/login-helper) — authenticate the browser session
