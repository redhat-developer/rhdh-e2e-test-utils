# CI/CD Integration

Integrate E2E tests with GitHub Actions.

## GitHub Actions Workflow

**.github/workflows/e2e-tests.yaml:**
```yaml
name: E2E Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  e2e-tests:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: "yarn"

      - name: Install dependencies
        run: yarn install --frozen-lockfile
        working-directory: e2e-tests

      - name: Install Playwright browsers
        run: yarn playwright install --with-deps
        working-directory: e2e-tests

      - name: Login to OpenShift
        uses: redhat-actions/oc-login@v1
        with:
          openshift_server_url: ${{ secrets.OPENSHIFT_SERVER }}
          openshift_token: ${{ secrets.OPENSHIFT_TOKEN }}

      - name: Run E2E tests
        run: yarn playwright test
        working-directory: e2e-tests
        env:
          CI: true
          RHDH_VERSION: "1.5"
          INSTALLATION_METHOD: "helm"
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: e2e-tests/playwright-report/
          retention-days: 30

      - name: Upload test videos
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: test-videos
          path: e2e-tests/test-results/
          retention-days: 7
```

## Required Secrets

Set these in your repository settings:

| Secret | Description |
|--------|-------------|
| `OPENSHIFT_SERVER` | OpenShift API server URL |
| `OPENSHIFT_TOKEN` | Service account token |
| `GITHUB_TOKEN` | Auto-provided by GitHub |

## Creating OpenShift Token

```bash
# Create service account
oc create serviceaccount e2e-tests -n default

# Grant permissions
oc adm policy add-cluster-role-to-user cluster-admin -z e2e-tests -n default

# Get token
oc create token e2e-tests -n default --duration=8760h
```

## Environment Variables in CI

The `CI` environment variable enables:

- Auto-cleanup of namespaces
- Increased retries (2 instead of 0)
- Non-interactive mode

## Parallel Jobs

Run projects in parallel:

```yaml
jobs:
  e2e-tests:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        project: [tech-radar, catalog, topology]

    steps:
      # ... setup steps ...

      - name: Run E2E tests
        run: yarn playwright test --project=${{ matrix.project }}
```

## Caching

```yaml
- name: Cache Playwright browsers
  uses: actions/cache@v4
  with:
    path: ~/.cache/ms-playwright
    key: playwright-${{ runner.os }}-${{ hashFiles('**/yarn.lock') }}
```

## Test Reporting

### HTML Report

```yaml
- name: Upload HTML report
  uses: actions/upload-artifact@v4
  with:
    name: playwright-report
    path: e2e-tests/playwright-report/
```

### JUnit Report

**playwright.config.ts:**
```typescript
export default defineConfig({
  reporter: [
    ["list"],
    ["html"],
    ["junit", { outputFile: "test-results/junit.xml" }],
  ],
});
```

```yaml
- name: Publish test results
  uses: mikepenz/action-junit-report@v4
  if: always()
  with:
    report_paths: "e2e-tests/test-results/junit.xml"
```

## Scheduled Runs

```yaml
on:
  schedule:
    - cron: "0 6 * * *"  # Daily at 6 AM
```

## Best Practices

1. **Use fail-fast: false** - Run all projects even if one fails
2. **Upload artifacts on failure** - Debug failed tests
3. **Cache dependencies** - Speed up runs
4. **Use matrix for parallel** - Faster feedback
5. **Set appropriate timeouts** - Avoid stuck jobs
