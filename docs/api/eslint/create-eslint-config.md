# createEslintConfig API

ESLint configuration factory.

## Import

```typescript
import { createEslintConfig } from "rhdh-e2e-test-utils/eslint";
```

## `createEslintConfig()`

```typescript
function createEslintConfig(dirname: string): ESLintConfig[]
```

Create ESLint flat config with Playwright and TypeScript rules.

| Parameter | Type | Description |
|-----------|------|-------------|
| `dirname` | `string` | Project directory (use `import.meta.dirname`) |

**Returns:** ESLint flat config array.

## Usage

```javascript
// eslint.config.js
import { createEslintConfig } from "rhdh-e2e-test-utils/eslint";

export default createEslintConfig(import.meta.dirname);
```

## Included Rules

- TypeScript ESLint recommended
- Playwright recommended
- Naming conventions
- File naming (kebab-case)
- Promise handling

## Extending

```javascript
import { createEslintConfig } from "rhdh-e2e-test-utils/eslint";

const baseConfig = createEslintConfig(import.meta.dirname);

export default [
  ...baseConfig,
  {
    rules: {
      "no-console": "warn",
    },
  },
];
```
