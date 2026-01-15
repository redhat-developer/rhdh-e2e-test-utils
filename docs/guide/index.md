# Getting Started

`rhdh-e2e-test-utils` is a comprehensive test utility package for Red Hat Developer Hub (RHDH) end-to-end testing. This package provides a unified framework for deploying RHDH instances, running Playwright tests, and managing Kubernetes resources in OpenShift environments.

## Overview

The package simplifies end-to-end testing for RHDH plugins by providing:

- **Automated RHDH Deployment**: Deploy RHDH instances via Helm or the RHDH Operator
- **Keycloak Integration**: Deploy and configure Keycloak for OIDC authentication testing
- **Modular Auth Configuration**: Switch between guest and Keycloak authentication with a single option
- **Playwright Integration**: Custom test fixtures that manage deployment lifecycle
- **Kubernetes Utilities**: Helper functions for managing namespaces, ConfigMaps, Secrets, and Routes
- **Configuration Merging**: YAML merging with environment variable substitution
- **Standardized ESLint Rules**: Pre-configured linting for Playwright tests

## Key Features

| Feature | Description |
|---------|-------------|
| Deploy RHDH | Using Helm charts or the RHDH Operator |
| Deploy Keycloak | For authentication testing with automatic realm, client, and user configuration |
| Modular authentication | Configuration for guest and Keycloak providers |
| Automatic namespace | Creation and cleanup |
| Dynamic plugin | Configuration support |
| UI, API, and common helpers | For test interactions |
| Kubernetes client helper | For OpenShift resources |
| Pre-configured Playwright | Settings optimized for RHDH testing |
| ESLint configuration | With Playwright and TypeScript best practices |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Your Test Project                         │
├─────────────────────────────────────────────────────────────┤
│  tests/                                                      │
│  ├── config/                                                 │
│  │   ├── app-config-rhdh.yaml                               │
│  │   ├── dynamic-plugins.yaml                               │
│  │   └── rhdh-secrets.yaml                                  │
│  └── specs/                                                  │
│      └── my-plugin.spec.ts                                  │
├─────────────────────────────────────────────────────────────┤
│                  rhdh-e2e-test-utils                         │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ Playwright   │  │ RHDH         │  │ Keycloak     │       │
│  │ Fixtures     │  │ Deployment   │  │ Helper       │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ UI Helper    │  │ Login Helper │  │ API Helper   │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ Page Objects │  │ K8s Client   │  │ YAML Utils   │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
├─────────────────────────────────────────────────────────────┤
│                    OpenShift Cluster                         │
│  ┌──────────────────────────┐  ┌──────────────────────────┐ │
│  │ RHDH Namespace           │  │ Keycloak Namespace       │ │
│  │ - Deployment             │  │ - StatefulSet            │ │
│  │ - ConfigMaps             │  │ - Services               │ │
│  │ - Secrets                │  │ - Routes                 │ │
│  │ - Routes                 │  │                          │ │
│  └──────────────────────────┘  └──────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Next Steps

1. [Installation](/guide/installation) - Install the package and dependencies
2. [Quick Start](/guide/quick-start) - Create your first E2E test
3. [Requirements](/guide/requirements) - System and cluster requirements
4. [Core Concepts](/guide/core-concepts/) - Understand the key concepts
