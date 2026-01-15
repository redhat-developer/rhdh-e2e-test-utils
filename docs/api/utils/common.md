# envsubst API

Environment variable substitution.

## Import

```typescript
import { envsubst } from "rhdh-e2e-test-utils/utils";
```

## `envsubst()`

```typescript
function envsubst(template: string): string
```

Replace environment variable placeholders in a string.

| Parameter | Type | Description |
|-----------|------|-------------|
| `template` | `string` | Template with placeholders |

**Returns:** String with substituted values.

## Syntax

| Pattern | Description |
|---------|-------------|
| `$VAR` | Simple substitution |
| `${VAR}` | Braced substitution |
| `${VAR:-default}` | Default if unset |

## Example

```typescript
import { envsubst } from "rhdh-e2e-test-utils/utils";

process.env.API_URL = "https://api.example.com";

// Simple
const result = envsubst("URL: $API_URL");
// "URL: https://api.example.com"

// With default
const result2 = envsubst("Port: ${PORT:-8080}");
// "Port: 8080" (if PORT not set)
```
