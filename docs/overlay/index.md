# Overlay Testing

::: warning Different from Package Documentation
This section documents how to write E2E tests **within the rhdh-plugin-export-overlays repository**.

If you want to learn how to use the `rhdh-e2e-test-utils` package in your own project, see the [Guide](/guide/).
:::

## What is Overlay Testing?

Overlay testing refers to end-to-end tests written for plugins in the [rhdh-plugin-export-overlays](https://github.com/redhat-developer/rhdh-plugin-export-overlays) repository. These tests:

- Live within workspace `e2e-tests/` directories
- Use `rhdh-e2e-test-utils` as a dependency
- Run in CI pipelines against overlay builds
- Test overlay-specific plugin configurations

## When to Use This Section

Use this documentation when you are:

- Adding E2E tests to a new plugin workspace in the overlay repository
- Modifying existing overlay E2E tests
- Understanding the overlay test structure and patterns
- Debugging CI pipeline issues for overlay tests

## Package vs Overlay Documentation

| Aspect | Package Docs (Guide) | Overlay Docs (This Section) |
|--------|---------------------|----------------------------|
| **Purpose** | How to use rhdh-e2e-test-utils in any project | How to write tests within rhdh-plugin-export-overlays |
| **Audience** | External consumers of the package | Overlay repository contributors |
| **Focus** | API reference, fixtures, helpers | Repository structure, CI integration |
| **Examples** | Generic plugin testing | Tech Radar, other overlay plugins |

## Key Concepts

### Automatic Plugin Configuration

The package automatically generates dynamic plugin configuration from metadata files in your workspace. This means:

- **Don't create `dynamic-plugins.yaml`** unless you have specific overrides
- All plugins in the workspace are enabled by default from metadata
- Plugin configurations come from `metadata/*.yaml` files (Package CRD format)

See [Configuration Files](./test-structure/configuration-files#dynamic-plugins-yaml-optional) for details.

### PR OCI Image Builds

When testing PRs, the `/publish` command builds OCI images that RHDH uses automatically:

- Local plugin paths are replaced with OCI URLs in CI
- The `GIT_PR_NUMBER` environment variable triggers this behavior
- You don't need to handle different configs for local vs CI

See [CI Pipeline](./tutorials/ci-pipeline#pr-oci-image-builds) for details.

## Quick Start

1. Navigate to your plugin workspace in the overlay repository
2. Create an `e2e-tests/` directory
3. Set up the standard test structure
4. Write your specs using `rhdh-e2e-test-utils`
5. Run tests locally or via CI

See [Getting Started](./getting-started) for a step-by-step walkthrough.

## Documentation Structure

### Test Structure
Learn about the standard directory layout and configuration files:
- [Directory Layout](./test-structure/directory-layout) - Standard folder structure
- [Configuration Files](./test-structure/configuration-files) - YAML configs for RHDH
- [Spec Files](./test-structure/spec-files) - Writing test specifications

### Tutorials
Step-by-step guides for common tasks:
- [Adding Tests to New Workspace](./tutorials/new-workspace) - Set up E2E tests from scratch
- [Plugin Configuration](./tutorials/plugin-config) - Configure plugin-specific settings
- [Pre-requisite Services](./tutorials/custom-deployment) - Deploy dependencies before RHDH
- [Running Tests Locally](./tutorials/running-locally) - Local development workflow
- [CI/CD Pipeline](./tutorials/ci-pipeline) - OpenShift CI integration

### Examples
Complete working examples:
- [Tech Radar Plugin](./examples/tech-radar) - Full annotated walkthrough
- [Basic Plugin Test](./examples/basic-plugin) - Minimal example

### Reference
Quick reference materials:
- [Environment Variables](./reference/environment-variables) - Configuration options
- [Package.json Scripts](./reference/scripts) - Available commands
- [Common Patterns](./reference/patterns) - Testing patterns
- [Troubleshooting](./reference/troubleshooting) - Common issues and solutions

## Related Pages

- [Guide](/guide/) - Package documentation for external projects
- [Plugin Metadata Guide](/guide/utilities/plugin-metadata) - How metadata configuration works
- [API Reference](/api/) - Full API documentation
- [Tutorials](/tutorials/) - Package usage tutorials
