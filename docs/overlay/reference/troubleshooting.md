# Troubleshooting

::: tip Overlay Documentation
This page covers writing tests within rhdh-plugin-export-overlays.
For using rhdh-e2e-test-utils in external projects, see the [Guide](/guide/).
:::

This page covers common issues and solutions for overlay E2E tests.

## Setup Issues

### "Node.js version X required"

**Problem:** Package requires Node.js 22+.

**Solution:**
```bash
# Check version
node --version

# Use nvm to install/switch
nvm install 22
nvm use 22
```

### "yarn: command not found"

**Problem:** Yarn is not installed.

**Solution:**
```bash
# Enable corepack (includes yarn)
corepack enable

# Or install yarn
npm install -g yarn
```

### "Cannot find module 'rhdh-e2e-test-utils'"

**Problem:** Dependencies not installed.

**Solution:**
```bash
yarn install
```

### "Executable doesn't exist" (Playwright browsers)

**Problem:** Playwright browsers not installed.

**Solution:**
```bash
npx playwright install
# Or with system dependencies
npx playwright install --with-deps
```

## Cluster Connection Issues

### "oc: command not found"

**Problem:** OpenShift CLI not installed.

**Solution:**
Download from [OpenShift CLI downloads](https://mirror.openshift.com/pub/openshift-v4/clients/ocp/latest/).

### "error: You must be logged in"

**Problem:** Not authenticated to cluster.

**Solution:**
```bash
oc login <cluster-url>
# Or
oc login --token=<token> --server=<server>
```

### "Unable to connect to the server"

**Problem:** Cluster unreachable.

**Solutions:**
- Check VPN connection
- Verify cluster URL is correct
- Check if cluster is running

## Deployment Issues

### "Namespace not found"

**Problem:** Test namespace doesn't exist or was deleted.

**Solution:** The namespace is created automatically. If it's missing, re-run the tests.

### "Deployment timeout"

**Problem:** RHDH deployment takes too long.

**Solutions:**
- Check cluster resources
- Check deployment logs:
  ```bash
  oc logs -f deployment/rhdh -n <namespace>
  ```
- Increase timeout in config

### "ImagePullBackOff"

**Problem:** Cannot pull container images.

**Solutions:**
- Check image pull secrets
- Verify registry access
- Check image name/tag

### "Keycloak deployment failed"

**Problem:** Keycloak fails to deploy.

**Solutions:**
- Check Keycloak namespace for errors:
  ```bash
  oc get pods -n rhdh-keycloak
  oc logs -f deployment/keycloak -n rhdh-keycloak
  ```
- If using guest auth and don't need Keycloak:
  ```bash
  SKIP_KEYCLOAK_DEPLOYMENT=true yarn test
  ```
- Check cluster resources (Keycloak requires memory/CPU)

## Test Failures

### "Element not found"

**Problem:** UI element not present.

**Solutions:**
- Add wait:
  ```typescript
  await page.locator('text="Element"').waitFor({ state: "visible" });
  ```
- Check selector:
  ```typescript
  await page.pause();  // Debug in browser
  ```
- Verify page loaded:
  ```typescript
  await uiHelper.waitForLoad();
  ```

### "Timeout waiting for selector"

**Problem:** Element takes too long to appear.

**Solutions:**
- Increase timeout:
  ```typescript
  await page.locator('text="Slow"').waitFor({ timeout: 60000 });
  ```
- Check if element exists at all (use headed mode)

### "Login failed"

**Problem:** Authentication fails.

**Solutions:**
- Check Keycloak is running
- Verify credentials (default: test1/test1@123)
- Check auth configuration

### "Navigation failed"

**Problem:** Page navigation fails.

**Solutions:**
- Check baseURL is correct
- Wait for navigation:
  ```typescript
  await page.waitForLoadState("networkidle");
  ```

## Environment Variable Issues

### "Variable undefined"

**Problem:** Environment variable not set.

**Solutions:**
- Check `.env` file exists and contains variable
- Verify dotenv is loaded:
  ```typescript
  import dotenv from "dotenv";
  dotenv.config({ path: `${import.meta.dirname}/.env` });
  ```
- Set in test code:
  ```typescript
  process.env.MY_VAR = "value";
  ```

### "Variable not substituted in YAML"

**Problem:** `${VAR}` appears literally in config.

**Solutions:**
- Set variable before `rhdh.deploy()`
- Check variable name matches exactly
- Verify envsubst is being applied

## OpenShift CI Issues

### "Tests pass locally but fail in CI"

**Common causes:**
- Missing Vault secrets
- Secrets not prefixed with `VAULT_`
- Missing Vault annotations
- Different cluster configuration

**Solutions:**
- Check CI logs for specific error
- Verify secrets in Vault have `VAULT_` prefix
- Check Vault path has correct annotations:
  ```json
  {
    "secretsync/target-name": "rhdh-plugin-export-overlays",
    "secretsync/target-namespace": "test-credentials"
  }
  ```

### "Vault secret not available"

**Problem:** Environment variable from Vault is undefined.

**Solutions:**
- Verify secret name starts with `VAULT_`
- Check secret is in correct Vault path (global or workspace-specific)
- Verify Vault path has required annotations
- Request Vault access in team-rhdh channel if needed

### "Resource quota exceeded"

**Problem:** Cluster limits reached.

**Solutions:**
- Clean up old namespaces
- Request quota increase
- Run fewer parallel tests

### "Connection refused"

**Problem:** Service not accessible.

**Solutions:**
- Wait for service to be ready
- Check route/service configuration
- Verify network policies

## Debugging Tips

### Use Headed Mode

```bash
yarn test:headed
```

### Use Playwright UI

```bash
yarn test:ui
```

### Add Debug Pause

```typescript
await page.pause();  // Pauses for manual inspection
```

### Take Screenshots

```typescript
await page.screenshot({ path: "debug.png" });
```

### View Traces

```bash
npx playwright show-trace playwright-report/trace.zip
```

### Check Logs

```typescript
page.on("console", msg => console.log(msg.text()));
page.on("pageerror", err => console.log(err));
```

## Getting Help

If you're still stuck:

1. Check the [Playwright documentation](https://playwright.dev/docs/intro)
2. Review [rhdh-e2e-test-utils documentation](/guide/)
3. Check the overlay repository issues
4. Ask in the team chat

## Related Pages

- [Running Tests Locally](/overlay/tutorials/running-locally) - Local workflow
- [CI/CD Pipeline](/overlay/tutorials/ci-pipeline) - CI configuration
- [Common Patterns](./patterns) - Best practices
