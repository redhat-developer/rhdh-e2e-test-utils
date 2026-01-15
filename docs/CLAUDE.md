# Documentation Guide for Claude

This file contains essential information for maintaining and extending the VitePress documentation for `rhdh-e2e-test-utils`.

## Documentation Structure

```
docs/
├── .vitepress/
│   └── config.ts          # VitePress configuration (nav, sidebar, theme)
├── snippets/              # Reusable code snippets (included via <!--@include:-->)
├── guide/                 # Conceptual documentation
│   ├── core-concepts/     # Architecture, fixtures, patterns
│   ├── deployment/        # RHDH, Keycloak, Helm, Operator
│   ├── helpers/           # UIhelper, LoginHelper, APIHelper
│   ├── page-objects/      # CatalogPage, HomePage, etc.
│   ├── utilities/         # Kubernetes client, bash, YAML merging
│   └── configuration/     # Config files, ESLint, TypeScript
├── api/                   # API reference (method signatures, types)
│   ├── deployment/        # RHDHDeployment, KeycloakHelper
│   ├── playwright/        # Fixtures, base config, global setup
│   ├── helpers/           # Helper class APIs
│   ├── pages/             # Page object APIs
│   ├── utils/             # Utility APIs
│   └── eslint/            # ESLint config API
├── tutorials/             # Step-by-step learning guides
├── examples/              # Copy-paste ready code examples
├── index.md               # Home page
└── changelog.md           # Version history
```

## Key Conventions

### Naming Conventions
- **Class name**: `UIhelper` (capital U, lowercase h) - matches source code
- **Fixture variable**: `uiHelper` (camelCase) - used in test fixtures
- **Method names**: Follow source exactly (e.g., `verifyTextinCard` not `verifyTextInCard`)
- **Project name in examples**: Use `"my-plugin"` consistently

### Code Examples
- Use TypeScript for all code examples
- Include imports at the top of code blocks
- Use the fixture pattern (recommended) over direct instantiation
- Standard test structure:
  ```typescript
  import { test, expect } from "rhdh-e2e-test-utils/test";

  test.describe("Feature", () => {
    test.beforeAll(async ({ rhdh }) => { /* deploy */ });
    test.beforeEach(async ({ loginHelper }) => { /* login */ });
    test("should...", async ({ uiHelper }) => { /* test */ });
  });
  ```

### Reusable Snippets
Located in `docs/snippets/`. Include them using:
```markdown
<!--@include: @/snippets/keycloak-credentials.md-->
```

Available snippets:
- `playwright-config.ts` - Base Playwright config
- `env-example.env` - Environment variables
- `basic-test.ts` - Basic test template
- `keycloak-test.ts` - Keycloak auth test
- `guest-test.ts` - Guest auth test
- `global-setup.ts` - Global setup template
- `app-config-rhdh.yaml` - RHDH config template
- `keycloak-credentials.md` - Default user credentials table
- `error-handling.ts` - Error handling patterns
- `serial-vs-parallel.ts` - Testing patterns comparison

### Cross-References
Always add "Related Pages" section at the end of documentation pages:
```markdown
## Related Pages

- [Page Name](/path/to/page.md) - Brief description
```

### Guide vs API vs Tutorial vs Example

| Section | Purpose | Content Style |
|---------|---------|---------------|
| **Guide** | Explain concepts | Detailed prose, multiple examples, best practices |
| **API** | Reference | Method signatures, parameter tables, brief examples |
| **Tutorial** | Teach step-by-step | Sequential steps, explanations, learning-focused |
| **Example** | Copy-paste code | Minimal prose, complete working code |

## VitePress Configuration

### Adding New Pages
1. Create the `.md` file in the appropriate directory
2. Update `docs/.vitepress/config.ts` to add to sidebar:
   ```typescript
   {
     text: "Section Name",
     items: [
       { text: "Page Title", link: "/path/to/page" },
     ],
   }
   ```

### Sidebar Structure
- `collapsed: false` - Section expanded by default
- `collapsed: true` - Section collapsed by default
- Items without `collapsed` are always visible

## Source Code Locations

When documenting, reference these source files:

| Component | Source Path |
|-----------|-------------|
| UIhelper | `src/playwright/helpers/ui-helper.ts` |
| LoginHelper | `src/playwright/helpers/login-helper.ts` |
| APIHelper | `src/playwright/helpers/api-helper.ts` |
| RHDHDeployment | `src/deployment/rhdh/rhdh-deployment.ts` |
| KeycloakHelper | `src/deployment/keycloak/keycloak-helper.ts` |
| Page Objects | `src/playwright/pages/*.ts` |
| Fixtures | `src/playwright/fixtures/test.ts` |
| Base Config | `src/playwright/base-config.ts` |
| Global Setup | `src/playwright/global-setup.ts` |

## Common Tasks

### Update API Documentation
1. Read the source file to get accurate method signatures
2. Update both Guide (`/guide/helpers/`) and API (`/api/helpers/`) sections
3. Ensure method names match source exactly

### Add New Feature Documentation
1. Add to Guide section with detailed explanation
2. Add to API section with method signatures
3. Add example to Examples section if applicable
4. Update Related Pages in relevant files
5. Add to sidebar in `config.ts`

### Update Version
1. Update version in `docs/.vitepress/config.ts` nav dropdown
2. Update `docs/changelog.md` with changes

## Standalone Documentation

The docs are a standalone package, independent of the root project. This allows:
- Separate dependency management
- Faster CI builds (no need to install root dependencies)
- Easier local development

### Setup

```bash
corepack enable  # Enable Yarn 3 via Corepack (one-time setup)
cd docs
yarn install
```

### Build Commands

Run from the `docs/` directory:

```bash
yarn dev      # Start dev server (http://localhost:5173)
yarn build    # Build for production
yarn preview  # Preview production build
```

### Package Structure

```
docs/
├── package.json          # Standalone dependencies (vitepress only)
├── node_modules/         # Local dependencies (gitignored)
├── .vitepress/
│   ├── config.ts         # VitePress configuration
│   ├── cache/            # Build cache (gitignored)
│   └── dist/             # Build output (gitignored)
└── ...
```

## GitHub Pages Deployment

The documentation automatically deploys via `.github/workflows/deploy-docs.yml` when:
- Changes are pushed to `main` branch in `docs/` directory
- Manually triggered via workflow_dispatch

The workflow:
1. Checks out the repository
2. Runs `yarn install` in `docs/` directory
3. Runs `yarn build` in `docs/` directory
4. Deploys `.vitepress/dist` to GitHub Pages

Base URL is configured as `/rhdh-e2e-test-utils/` in `config.ts`.

## Known Issues / TODOs

- [ ] Consider adding search indexing for Algolia (currently using local search)
- [ ] Add API documentation for remaining utility functions
- [ ] Consider adding interactive code examples with StackBlitz

## Package Exports Reference

| Export | Import Path | Description |
|--------|-------------|-------------|
| Test fixtures | `rhdh-e2e-test-utils/test` | Main test API |
| Playwright config | `rhdh-e2e-test-utils/playwright-config` | Base config |
| RHDH deployment | `rhdh-e2e-test-utils/rhdh` | RHDHDeployment |
| Keycloak | `rhdh-e2e-test-utils/keycloak` | KeycloakHelper |
| Helpers | `rhdh-e2e-test-utils/helpers` | UIhelper, LoginHelper, etc. |
| Page objects | `rhdh-e2e-test-utils/pages` | CatalogPage, HomePage, etc. |
| Utilities | `rhdh-e2e-test-utils/utils` | KubernetesClientHelper, etc. |
| ESLint | `rhdh-e2e-test-utils/eslint` | ESLint config |
| TypeScript | `rhdh-e2e-test-utils/tsconfig` | TSConfig base |
