# API Operations

Examples of GitHub and Backstage API operations.

## GitHub Operations

```typescript
import { test, expect } from "rhdh-e2e-test-utils/test";
import { APIHelper } from "rhdh-e2e-test-utils/helpers";

test.describe("GitHub API", () => {
  const owner = "my-org";
  const repoName = `test-repo-${Date.now()}`;

  test.afterAll(async () => {
    // Cleanup
    try {
      await APIHelper.deleteGitHubRepo(owner, repoName);
    } catch {
      // Ignore if already deleted
    }
  });

  test("create repository", async () => {
    await APIHelper.createGitHubRepo(owner, repoName, {
      private: true,
      description: "E2E test repository",
    });
  });

  test("get pull requests", async () => {
    const prs = await APIHelper.getGitHubPRs(owner, "main-repo", "open");
    expect(prs.length).toBeGreaterThanOrEqual(0);
  });

  test("create and merge PR", async () => {
    // Create PR
    await APIHelper.createPullRequest(owner, repoName, {
      title: "Test PR",
      head: "feature-branch",
      base: "main",
      body: "Test pull request",
    });

    // Get PRs
    const prs = await APIHelper.getGitHubPRs(owner, repoName, "open");
    expect(prs.length).toBeGreaterThan(0);

    // Merge first PR
    await APIHelper.mergePullRequest(owner, repoName, prs[0].number);
  });
});
```

## Backstage Catalog API

```typescript
import { test, expect } from "rhdh-e2e-test-utils/test";
import { APIHelper } from "rhdh-e2e-test-utils/helpers";

test.describe("Backstage Catalog API", () => {
  let apiHelper: APIHelper;

  test.beforeAll(async ({ rhdh }) => {
    await rhdh.configure({ auth: "keycloak" });
    await rhdh.deploy();

    apiHelper = new APIHelper();
    await apiHelper.setBaseUrl(rhdh.rhdhUrl);
    await apiHelper.setStaticToken(process.env.BACKEND_TOKEN!);
  });

  test("get all users", async () => {
    const users = await apiHelper.getAllCatalogUsersFromAPI();
    expect(users.length).toBeGreaterThan(0);
  });

  test("get all groups", async () => {
    const groups = await apiHelper.getAllCatalogGroupsFromAPI();
    expect(groups.length).toBeGreaterThan(0);
  });

  test("get entity by name", async () => {
    const entity = await apiHelper.getEntityByName(
      "component",
      "default",
      "example-component"
    );
    expect(entity).toBeDefined();
    expect(entity.metadata.name).toBe("example-component");
  });

  test("refresh entity", async () => {
    await apiHelper.scheduleEntityRefreshFromAPI(
      "example-component",
      "component"
    );

    // Wait for refresh
    await new Promise(resolve => setTimeout(resolve, 5000));
  });

  test("get locations", async () => {
    const locations = await apiHelper.getAllCatalogLocationsFromAPI();
    expect(locations.length).toBeGreaterThan(0);
  });
});
```

## Combined Example

```typescript
import { test, expect } from "rhdh-e2e-test-utils/test";
import { APIHelper } from "rhdh-e2e-test-utils/helpers";
import { CatalogImportPage } from "rhdh-e2e-test-utils/pages";

test.describe("Full Workflow", () => {
  const owner = "my-org";
  const repoName = `e2e-test-${Date.now()}`;
  let apiHelper: APIHelper;

  test.beforeAll(async ({ rhdh }) => {
    await rhdh.configure({ auth: "keycloak" });
    await rhdh.deploy();

    apiHelper = new APIHelper();
    await apiHelper.setBaseUrl(rhdh.rhdhUrl);

    // Create test repository
    await APIHelper.createGitHubRepo(owner, repoName);
  });

  test.afterAll(async () => {
    await APIHelper.deleteGitHubRepo(owner, repoName);
  });

  test("register repo as component", async ({ page, loginHelper }) => {
    await loginHelper.loginAsKeycloakUser();

    const importPage = new CatalogImportPage(page);
    await importPage.registerExistingComponent(
      `https://github.com/${owner}/${repoName}/blob/main/catalog-info.yaml`
    );
  });

  test("verify component in catalog", async () => {
    const entity = await apiHelper.getEntityByName(
      "component",
      "default",
      repoName
    );
    expect(entity).toBeDefined();
  });
});
```

## Environment Variables

```bash
# Required for GitHub operations
GITHUB_TOKEN=ghp_xxxxx

# Required for Backstage API
BACKEND_TOKEN=your-backend-token
```
