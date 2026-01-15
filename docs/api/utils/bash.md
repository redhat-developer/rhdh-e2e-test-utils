# Bash ($) API

Shell command execution via zx.

## Import

```typescript
import { $ } from "rhdh-e2e-test-utils/utils";
```

## Usage

```typescript
// Execute command
await $`echo "Hello"`;

// With variables
const ns = "my-namespace";
await $`oc get pods -n ${ns}`;

// Capture output
const result = await $`oc get pods -o json`;
console.log(result.stdout);
```

## Return Type

```typescript
interface ProcessOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
}
```

## Error Handling

```typescript
try {
  await $`oc get pods -n nonexistent`;
} catch (error) {
  console.log(error.exitCode);
  console.log(error.stderr);
}
```

## Example

```typescript
import { $ } from "rhdh-e2e-test-utils/utils";

// Run setup script
await $`bash scripts/setup.sh ${namespace}`;

// Get route host
const result = await $`oc get route my-route -n ${ns} -o jsonpath='{.spec.host}'`;
const host = result.stdout.trim();
```
