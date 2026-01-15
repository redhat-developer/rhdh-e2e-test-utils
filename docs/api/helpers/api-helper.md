# APIHelper API

Utilities for GitHub and Backstage API interactions.

## Import

```typescript
import { APIHelper } from "rhdh-e2e-test-utils/helpers";
```

## Static Methods (GitHub)

### `createGitHubRepo()`

```typescript
static async createGitHubRepo(
  owner: string,
  name: string,
  options?: { private?: boolean; description?: string }
): Promise<void>
```

### `deleteGitHubRepo()`

```typescript
static async deleteGitHubRepo(owner: string, name: string): Promise<void>
```

### `getGitHubPRs()`

```typescript
static async getGitHubPRs(
  owner: string,
  repo: string,
  state?: "open" | "closed" | "all"
): Promise<PullRequest[]>
```

### `createPullRequest()`

```typescript
static async createPullRequest(
  owner: string,
  repo: string,
  options: { title: string; head: string; base: string; body?: string }
): Promise<void>
```

### `mergePullRequest()`

```typescript
static async mergePullRequest(
  owner: string,
  repo: string,
  prNumber: number
): Promise<void>
```

## Instance Methods (Backstage)

### Constructor

```typescript
new APIHelper()
```

### `setBaseUrl()`

```typescript
async setBaseUrl(url: string): Promise<void>
```

### `setStaticToken()`

```typescript
async setStaticToken(token: string): Promise<void>
```

### `getAllCatalogUsersFromAPI()`

```typescript
async getAllCatalogUsersFromAPI(): Promise<User[]>
```

### `getAllCatalogGroupsFromAPI()`

```typescript
async getAllCatalogGroupsFromAPI(): Promise<Group[]>
```

### `getAllCatalogLocationsFromAPI()`

```typescript
async getAllCatalogLocationsFromAPI(): Promise<Location[]>
```

### `getEntityByName()`

```typescript
async getEntityByName(
  kind: string,
  namespace: string,
  name: string
): Promise<Entity>
```

### `scheduleEntityRefreshFromAPI()`

```typescript
async scheduleEntityRefreshFromAPI(
  name: string,
  kind: string,
  token?: string
): Promise<void>
```

### `deleteEntityFromCatalog()`

```typescript
async deleteEntityFromCatalog(
  kind: string,
  namespace: string,
  name: string
): Promise<void>
```

## Example

```typescript
import { APIHelper } from "rhdh-e2e-test-utils/helpers";

// GitHub operations
await APIHelper.createGitHubRepo("my-org", "test-repo");
await APIHelper.deleteGitHubRepo("my-org", "test-repo");

// Backstage operations
const apiHelper = new APIHelper();
await apiHelper.setBaseUrl("https://backstage.example.com");
await apiHelper.setStaticToken(process.env.BACKEND_TOKEN!);

const users = await apiHelper.getAllCatalogUsersFromAPI();
console.log(`Found ${users.length} users`);
```
