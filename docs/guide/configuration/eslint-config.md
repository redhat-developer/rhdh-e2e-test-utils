# ESLint Configuration

The package provides a pre-configured ESLint setup for Playwright tests.

## Usage

Create `eslint.config.js` in your project:

```javascript
import { createEslintConfig } from "rhdh-e2e-test-utils/eslint";

export default createEslintConfig(import.meta.dirname);
```

## What's Included

The configuration includes:

### TypeScript Rules

- TypeScript ESLint recommended rules
- Naming conventions for variables, functions, types
- Strict type checking

### Playwright Rules

- Playwright recommended rules
- Test organization best practices
- Assertion requirements

### File Naming

- Kebab-case for files and folders
- PascalCase for page object files

### Promise Handling

- Proper async/await usage
- No floating promises

## Custom Rules

The configuration enforces:

```javascript
{
  // Naming conventions
  "@typescript-eslint/naming-convention": [
    "error",
    {
      "selector": "default",
      "format": ["camelCase"]
    },
    {
      "selector": "variable",
      "format": ["camelCase", "UPPER_CASE", "PascalCase"]
    },
    {
      "selector": "typeLike",
      "format": ["PascalCase"]
    }
  ],

  // File naming
  "check-file/filename-naming-convention": [
    "error",
    { "**/*.ts": "KEBAB_CASE" }
  ],

  // Playwright
  "playwright/expect-expect": "error",
  "playwright/no-focused-test": "error",
  "playwright/no-skipped-test": "warn"
}
```

## Extending the Configuration

Add custom rules after the base config:

```javascript
import { createEslintConfig } from "rhdh-e2e-test-utils/eslint";

const baseConfig = createEslintConfig(import.meta.dirname);

export default [
  ...baseConfig,
  {
    rules: {
      // Your custom rules
      "no-console": "warn",
      "@typescript-eslint/no-unused-vars": "error",
    },
  },
];
```

## Ignoring Files

```javascript
import { createEslintConfig } from "rhdh-e2e-test-utils/eslint";

const baseConfig = createEslintConfig(import.meta.dirname);

export default [
  ...baseConfig,
  {
    ignores: ["**/generated/**", "**/fixtures/**"],
  },
];
```

## Running ESLint

Add scripts to `package.json`:

```json
{
  "scripts": {
    "lint": "eslint .",
    "lint:fix": "eslint . --fix"
  }
}
```

Run:
```bash
yarn lint
yarn lint:fix
```
