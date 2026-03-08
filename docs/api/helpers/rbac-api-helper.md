# RbacApiHelper API

Manages RBAC roles, policies, and conditional permission policies via the RHDH Permission API.

## Import

```typescript
import {
  RbacApiHelper,
  Response,
  type Policy,
} from '@red-hat-developer-hub/e2e-test-utils/helpers';
```

## Types

### `Policy`

```typescript
interface Policy {
  entityReference: string;
  permission: string;
  policy: string;
  effect: string;
}
```

## `RbacApiHelper`

### Static Methods

#### `build()`

```typescript
static async build(token: string): Promise<RbacApiHelper>
```

| Parameter | Type     | Description              |
| --------- | -------- | ------------------------ |
| `token`   | `string` | Backstage identity token |

**Returns** `Promise<RbacApiHelper>` — a fully initialized instance.

### Instance Methods

#### `getPoliciesByRole()`

```typescript
async getPoliciesByRole(role: string): Promise<APIResponse>
```

| Parameter | Type     | Description                          |
| --------- | -------- | ------------------------------------ |
| `role`    | `string` | Role name in the `default` namespace |

#### `getConditions()`

```typescript
async getConditions(): Promise<APIResponse>
```

Fetches all conditional policies across every role.

#### `getConditionsByRole()`

```typescript
async getConditionsByRole(
  role: string,
  remainingConditions: RoleConditionalPolicyDecision<PermissionAction>[]
): Promise<RoleConditionalPolicyDecision<PermissionAction>[]>
```

| Parameter             | Type                                                | Description                                               |
| --------------------- | --------------------------------------------------- | --------------------------------------------------------- |
| `role`                | `string`                                            | Full role entity reference, e.g. `"role:default/my-role"` |
| `remainingConditions` | `RoleConditionalPolicyDecision<PermissionAction>[]` | Conditions array fetched from `getConditions()`           |

Filters locally — no additional HTTP request is made.

#### `deleteRole()`

```typescript
async deleteRole(role: string): Promise<APIResponse>
```

| Parameter | Type     | Description                          |
| --------- | -------- | ------------------------------------ |
| `role`    | `string` | Role name in the `default` namespace |

#### `deletePolicy()`

```typescript
async deletePolicy(role: string, policies: Policy[]): Promise<APIResponse>
```

| Parameter  | Type       | Description                          |
| ---------- | ---------- | ------------------------------------ |
| `role`     | `string`   | Role name in the `default` namespace |
| `policies` | `Policy[]` | Array of policy objects to delete    |

#### `deleteCondition()`

```typescript
async deleteCondition(id: string): Promise<APIResponse>
```

| Parameter | Type     | Description                                                  |
| --------- | -------- | ------------------------------------------------------------ |
| `id`      | `string` | The `id` field from a `RoleConditionalPolicyDecision` object |

## `Response`

### Static Methods

#### `removeMetadataFromResponse()`

```typescript
static async removeMetadataFromResponse(
  response: APIResponse
): Promise<unknown[]>
```

Parses a Playwright `APIResponse` and strips the `metadata` field from each item in the response array.

**Throws** `Error` if the response cannot be parsed or is not an array.

## Example

```typescript
import {
  AuthApiHelper,
  RbacApiHelper,
  Response,
  type Policy,
} from '@red-hat-developer-hub/e2e-test-utils/helpers';

const authApiHelper = new AuthApiHelper(page);
const token = await authApiHelper.getToken();
const rbacApiHelper = await RbacApiHelper.build(token);

// Delete conditional policies for a role
const conditionsResponse = await rbacApiHelper.getConditions();
const allConditions = await conditionsResponse.json();
const roleConditions = await rbacApiHelper.getConditionsByRole(
  'role:default/my-role',
  allConditions,
);
for (const condition of roleConditions) {
  await rbacApiHelper.deleteCondition(condition.id);
}

// Delete standard policies and role
const apiResponse = await rbacApiHelper.getPoliciesByRole('my-role');
const policies = (await Response.removeMetadataFromResponse(
  apiResponse,
)) as Policy[];
await rbacApiHelper.deletePolicy('my-role', policies);
await rbacApiHelper.deleteRole('my-role');
```
