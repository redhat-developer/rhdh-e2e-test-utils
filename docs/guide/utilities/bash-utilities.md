# Bash Utilities

The package exports `$` from the `zx` library for executing shell commands.

## Usage

```typescript
import { $ } from "rhdh-e2e-test-utils/utils";
```

## Basic Commands

```typescript
// Simple command
await $`echo "Hello World"`;

// With variables
const namespace = "my-namespace";
await $`oc get pods -n ${namespace}`;
```

## Capturing Output

```typescript
const result = await $`oc get pods -n my-namespace -o json`;
console.log(result.stdout);

// Parse JSON output
const pods = JSON.parse(result.stdout);
console.log(`Found ${pods.items.length} pods`);
```

## Error Handling

```typescript
try {
  await $`oc get pods -n nonexistent`;
} catch (error) {
  console.log(`Command failed with exit code: ${error.exitCode}`);
  console.log(`stderr: ${error.stderr}`);
}
```

## Complete Example

```typescript
import { test } from "rhdh-e2e-test-utils/test";
import { $ } from "rhdh-e2e-test-utils/utils";

test.beforeAll(async ({ rhdh }) => {
  const namespace = rhdh.deploymentConfig.namespace;

  // Configure RHDH first
  await rhdh.configure({ auth: "keycloak" });

  // Run setup script
  await $`bash ${import.meta.dirname}/scripts/setup.sh ${namespace}`;

  // Get route from deployed service
  const result = await $`oc get route my-service -n ${namespace} -o jsonpath='{.spec.host}'`;
  process.env.MY_SERVICE_URL = `https://${result.stdout.trim()}`;

  // Deploy RHDH
  await rhdh.deploy();
});
```

## Best Practices

1. **Use template literals** - Always use backticks for `$`
2. **Handle errors** - Wrap in try/catch for commands that may fail
3. **Quote variables** - Variables are automatically quoted
4. **Use absolute paths** - For scripts and files
