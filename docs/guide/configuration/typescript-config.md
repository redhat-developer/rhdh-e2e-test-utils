# TypeScript Configuration

The package provides a base TypeScript configuration to extend.

## Usage

Create `tsconfig.json` in your project:

```json
{
  "extends": "rhdh-e2e-test-utils/tsconfig",
  "include": ["tests/**/*.ts", "playwright.config.ts"]
}
```

## What's Included

The base configuration includes:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true
  }
}
```

## Key Settings

| Setting | Value | Description |
|---------|-------|-------------|
| `target` | ES2022 | Modern JavaScript features |
| `module` | ESNext | ES modules |
| `moduleResolution` | bundler | Modern resolution |
| `strict` | true | Strict type checking |

## Customizing

Override settings in your `tsconfig.json`:

```json
{
  "extends": "rhdh-e2e-test-utils/tsconfig",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./tests"
  },
  "include": ["tests/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

## Multiple Configs

For complex projects, create multiple configs:

**tsconfig.json** (development):
```json
{
  "extends": "rhdh-e2e-test-utils/tsconfig",
  "include": ["tests/**/*.ts", "playwright.config.ts"]
}
```

**tsconfig.build.json** (if building):
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "declaration": true
  },
  "exclude": ["**/*.spec.ts"]
}
```

## Path Aliases

Add path aliases for cleaner imports:

```json
{
  "extends": "rhdh-e2e-test-utils/tsconfig",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@pages/*": ["tests/pages/*"],
      "@helpers/*": ["tests/helpers/*"],
      "@config/*": ["tests/config/*"]
    }
  }
}
```

Usage:
```typescript
import { MyPage } from "@pages/my-page";
import { myHelper } from "@helpers/my-helper";
```

::: warning
Path aliases require additional configuration in Playwright. Use `tsconfig-paths` or configure in `playwright.config.ts`.
:::
