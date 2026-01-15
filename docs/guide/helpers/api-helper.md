# APIHelper

The `APIHelper` class provides utilities for API interactions with both GitHub and Backstage catalog.

## Importing

```typescript
import { APIHelper } from "rhdh-e2e-test-utils/helpers";
```

## GitHub API Operations

GitHub operations are available as static methods.

### Prerequisites

Set the `GITHUB_TOKEN` environment variable with appropriate permissions.

### `createGitHubRepo(owner, name, options?)`

Create a GitHub repository:

```typescript
await APIHelper.createGitHubRepo("my-org", "new-repo");

// With options
await APIHelper.createGitHubRepo("my-org", "new-repo", {
  private: true,
  description: "Test repository",
});
```

### `deleteGitHubRepo(owner, name)`

Delete a GitHub repository:

```typescript
await APIHelper.deleteGitHubRepo("my-org", "test-repo");
```

### `getGitHubPRs(owner, repo, state?)`

Get pull requests:

```typescript
// Get open PRs
const openPRs = await APIHelper.getGitHubPRs("my-org", "my-repo", "open");

// Get closed PRs
const closedPRs = await APIHelper.getGitHubPRs("my-org", "my-repo", "closed");

// Get all PRs
const allPRs = await APIHelper.getGitHubPRs("my-org", "my-repo", "all");
```

### `createPullRequest(owner, repo, options)`

Create a pull request:

```typescript
await APIHelper.createPullRequest("my-org", "my-repo", {
  title: "Feature: New functionality",
  head: "feature-branch",
  base: "main",
  body: "Description of changes",
});
```

### `mergePullRequest(owner, repo, prNumber)`

Merge a pull request:

```typescript
await APIHelper.mergePullRequest("my-org", "my-repo", 123);
```

## Backstage Catalog API Operations

Catalog operations require an instance of `APIHelper`.

### Setup

```typescript
const apiHelper = new APIHelper();
await apiHelper.setBaseUrl(rhdhUrl);
await apiHelper.setStaticToken(backendToken);
```

### `getAllCatalogUsersFromAPI()`

Get all users from the catalog:

```typescript
const users = await apiHelper.getAllCatalogUsersFromAPI();
console.log(users.length);
```

### `getAllCatalogGroupsFromAPI()`

Get all groups from the catalog:

```typescript
const groups = await apiHelper.getAllCatalogGroupsFromAPI();
console.log(groups.length);
```

### `getAllCatalogLocationsFromAPI()`

Get all registered locations:

```typescript
const locations = await apiHelper.getAllCatalogLocationsFromAPI();
```

### `getEntityByName(kind, namespace, name)`

Get a specific entity:

```typescript
const component = await apiHelper.getEntityByName(
  "component",
  "default",
  "my-component"
);
```

### `scheduleEntityRefreshFromAPI(name, kind, token?)`

Schedule a catalog entity refresh:

```typescript
await apiHelper.scheduleEntityRefreshFromAPI(
  "my-component",
  "component",
  backendToken
);
```

### `deleteEntityFromCatalog(kind, namespace, name)`

Delete an entity from the catalog:

```typescript
await apiHelper.deleteEntityFromCatalog("component", "default", "my-component");
```

## Complete Examples

### GitHub Repository Lifecycle

```typescript
import { test } from "rhdh-e2e-test-utils/test";
import { APIHelper } from "rhdh-e2e-test-utils/helpers";

test.describe("GitHub operations", () => {
  const owner = "my-org";
  const repoName = `test-repo-${Date.now()}`;

  test.afterAll(async () => {
    // Cleanup
    await APIHelper.deleteGitHubRepo(owner, repoName);
  });

  test("create and use repository", async ({ page }) => {
    // Create repo
    await APIHelper.createGitHubRepo(owner, repoName, {
      description: "E2E test repository",
    });

    // Use in test
    await page.goto(`https://github.com/${owner}/${repoName}`);
  });
});
```

### Catalog Verification

```typescript
import { test, expect } from "rhdh-e2e-test-utils/test";
import { APIHelper } from "rhdh-e2e-test-utils/helpers";

test("verify catalog entities", async ({ rhdh }) => {
  const apiHelper = new APIHelper();
  await apiHelper.setBaseUrl(rhdh.rhdhUrl);
  await apiHelper.setStaticToken(process.env.BACKEND_TOKEN!);

  // Verify users exist
  const users = await apiHelper.getAllCatalogUsersFromAPI();
  expect(users.length).toBeGreaterThan(0);

  // Verify groups exist
  const groups = await apiHelper.getAllCatalogGroupsFromAPI();
  expect(groups.length).toBeGreaterThan(0);

  // Check specific entity
  const component = await apiHelper.getEntityByName(
    "component",
    "default",
    "my-component"
  );
  expect(component).toBeDefined();
});
```

### Entity Refresh

```typescript
import { test } from "rhdh-e2e-test-utils/test";
import { APIHelper } from "rhdh-e2e-test-utils/helpers";

test("refresh entity", async ({ rhdh }) => {
  const apiHelper = new APIHelper();
  await apiHelper.setBaseUrl(rhdh.rhdhUrl);
  await apiHelper.setStaticToken(process.env.BACKEND_TOKEN!);

  // Trigger refresh
  await apiHelper.scheduleEntityRefreshFromAPI(
    "my-component",
    "component"
  );

  // Wait for refresh to complete
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Verify updated entity
  const component = await apiHelper.getEntityByName(
    "component",
    "default",
    "my-component"
  );
  // Assert on updated fields
});
```

## Environment Variables

| Variable | Description | Used By |
|----------|-------------|---------|
| `GITHUB_TOKEN` | GitHub personal access token | GitHub operations |
| `BACKEND_TOKEN` | Backstage backend auth token | Catalog operations |

## Error Handling

```typescript
import { APIHelper } from "rhdh-e2e-test-utils/helpers";

try {
  await APIHelper.createGitHubRepo("my-org", "repo-name");
} catch (error) {
  if (error.message.includes("already exists")) {
    console.log("Repository already exists");
  } else {
    throw error;
  }
}
```

## Best Practices

1. **Clean up resources** - Delete repos/entities created during tests
2. **Use unique names** - Add timestamps or random strings to avoid conflicts
3. **Handle rate limits** - GitHub has API rate limits
4. **Use appropriate tokens** - Ensure tokens have required permissions
5. **Wait for propagation** - Allow time for catalog to sync after changes
