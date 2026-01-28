# Package.json Scripts

::: tip Overlay Documentation
This page covers writing tests within rhdh-plugin-export-overlays.
For using rhdh-e2e-test-utils in external projects, see the [Guide](/guide/).
:::

This page documents the standard scripts available in overlay E2E test packages.

## Test Scripts

### yarn test

Run all tests with default settings:

```bash
yarn test
```

Equivalent to:
```bash
playwright test
```

### yarn test:headed

Run tests with browser visible:

```bash
yarn test:headed
```

Useful for debugging and watching tests execute.

### yarn test:ui

Run tests with Playwright's interactive UI:

```bash
yarn test:ui
```

Features:
- Watch mode
- Step-by-step execution
- Test filtering
- Trace viewer

### yarn report

View the HTML test report:

```bash
yarn report
```

Opens the report in your default browser.

## Running Specific Tests

### By File

```bash
yarn test tests/specs/my-plugin.spec.ts
```

### By Test Name

```bash
yarn test -g "test name pattern"
```

### By Project

```bash
yarn test --project=tech-radar
```

## Code Quality Scripts

### yarn lint:check

Check for linting errors:

```bash
yarn lint:check
```

### yarn lint:fix

Auto-fix linting issues:

```bash
yarn lint:fix
```

### yarn prettier:check

Check code formatting:

```bash
yarn prettier:check
```

### yarn prettier:fix

Auto-format code:

```bash
yarn prettier:fix
```

### yarn check

Run all quality checks:

```bash
yarn check
```

Equivalent to:
```bash
tsc --noEmit && yarn lint:check && yarn prettier:check
```

## Script Definitions

Standard `package.json` scripts section:

```json
{
  "scripts": {
    "test": "playwright test",
    "report": "playwright show-report",
    "test:ui": "playwright test --ui",
    "test:headed": "playwright test --headed",
    "lint:check": "eslint .",
    "lint:fix": "eslint . --fix",
    "prettier:check": "prettier --check .",
    "prettier:fix": "prettier --write .",
    "check": "tsc --noEmit && yarn lint:check && yarn prettier:check"
  }
}
```

## Playwright CLI Options

### Common Options

| Option | Description |
|--------|-------------|
| `--headed` | Show browser window |
| `--ui` | Open interactive UI |
| `--debug` | Run with debugger |
| `-g "pattern"` | Filter tests by name |
| `--project=name` | Run specific project |
| `--retries=N` | Override retry count |
| `--workers=N` | Set parallel workers |
| `--timeout=N` | Set timeout (ms) |

### Examples

```bash
# Run with 1 worker (serial)
yarn test --workers=1

# Run with debug mode
yarn test --debug

# Run with increased timeout
yarn test --timeout=120000

# Run without retries
yarn test --retries=0
```

## Adding Custom Scripts

You can add custom scripts for your needs:

```json
{
  "scripts": {
    "test": "playwright test",
    "test:smoke": "playwright test --grep @smoke",
    "test:regression": "playwright test --grep @regression",
    "test:debug": "PWDEBUG=1 playwright test",
    "clean": "rm -rf playwright-report test-results"
  }
}
```

## Pre-Test Setup

Install dependencies and browsers:

```bash
# Install dependencies
yarn install

# Install Playwright browsers
npx playwright install

# Or install with system dependencies
npx playwright install --with-deps
```

## Related Pages

- [Running Tests Locally](/overlay/tutorials/running-locally) - Local workflow
- [CI/CD Pipeline](/overlay/tutorials/ci-pipeline) - CI execution
- [Directory Layout](/overlay/test-structure/directory-layout) - File structure
