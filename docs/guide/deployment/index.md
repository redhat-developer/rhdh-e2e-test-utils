# Deployment Overview

The package provides comprehensive deployment capabilities for RHDH and Keycloak to OpenShift clusters.

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    OpenShift Cluster                         │
│                                                              │
│  ┌─────────────────────────┐  ┌─────────────────────────┐   │
│  │   RHDH Namespace        │  │  Keycloak Namespace     │   │
│  │   (e.g., my-plugin)     │  │  (rhdh-keycloak)        │   │
│  │                         │  │                         │   │
│  │  ┌──────────────────┐   │  │  ┌──────────────────┐   │   │
│  │  │ RHDH Deployment  │   │  │  │ Keycloak         │   │   │
│  │  │ or Backstage CR  │   │  │  │ StatefulSet      │   │   │
│  │  └──────────────────┘   │  │  └──────────────────┘   │   │
│  │                         │  │                         │   │
│  │  ┌──────────────────┐   │  │  ┌──────────────────┐   │   │
│  │  │ ConfigMaps       │   │  │  │ PostgreSQL       │   │   │
│  │  │ - app-config     │   │  │  │ StatefulSet      │   │   │
│  │  │ - dynamic-plugins│   │  │  └──────────────────┘   │   │
│  │  └──────────────────┘   │  │                         │   │
│  │                         │  │  ┌──────────────────┐   │   │
│  │  ┌──────────────────┐   │  │  │ Routes           │   │   │
│  │  │ Secrets          │   │  │  │ - keycloak       │   │   │
│  │  │ - rhdh-secrets   │   │  │  └──────────────────┘   │   │
│  │  └──────────────────┘   │  │                         │   │
│  │                         │  └─────────────────────────┘   │
│  │  ┌──────────────────┐   │                                │
│  │  │ Routes           │   │                                │
│  │  │ - backstage      │   │                                │
│  │  └──────────────────┘   │                                │
│  └─────────────────────────┘                                │
└─────────────────────────────────────────────────────────────┘
```

## Deployment Methods

### Helm Deployment

Deploy RHDH using the official Helm chart:

```typescript
await rhdh.configure({
  method: "helm",
  valueFile: "tests/config/values.yaml",
});
await rhdh.deploy();
```

[Learn more about Helm Deployment →](/guide/deployment/helm-deployment)

### Operator Deployment

Deploy RHDH using the RHDH Operator:

```typescript
await rhdh.configure({
  method: "operator",
  subscription: "tests/config/subscription.yaml",
});
await rhdh.deploy();
```

[Learn more about Operator Deployment →](/guide/deployment/operator-deployment)

## Authentication Providers

### Guest Authentication

Simple authentication for development and testing:

```typescript
await rhdh.configure({ auth: "guest" });
```

### Keycloak Authentication

OIDC authentication via Keycloak:

```typescript
await rhdh.configure({ auth: "keycloak" });
```

[Learn more about Authentication →](/guide/deployment/authentication)

## Deployment Lifecycle

### 1. Configure

Set deployment options before deploying:

```typescript
await rhdh.configure({
  version: "1.5",
  method: "helm",
  auth: "keycloak",
  appConfig: "tests/config/app-config.yaml",
  secrets: "tests/config/secrets.yaml",
  dynamicPlugins: "tests/config/plugins.yaml",
});
```

### 2. Deploy

Deploy RHDH to the cluster:

```typescript
await rhdh.deploy();
```

This:
1. Creates the namespace
2. [Injects plugin metadata](/guide/configuration/config-files#plugin-metadata-injection) into dynamic plugins
3. Applies ConfigMaps
4. Applies Secrets (with env substitution)
5. Installs RHDH (Helm or Operator)
6. Waits for deployment to be ready

### 3. Access

Access the deployed RHDH instance:

```typescript
const url = rhdh.rhdhUrl;
const namespace = rhdh.deploymentConfig.namespace;
```

### 4. Update (Optional)

Update configuration during tests:

```typescript
// Apply new configs
await rhdh.rolloutRestart();
```

### 5. Cleanup

Delete resources after tests (automatic in CI):

```typescript
await rhdh.teardown();
```

## Configuration Merging

Configurations are merged in layers:

1. **Common configs** - Base configurations
2. **Auth configs** - Provider-specific configs
3. **Project configs** - Your custom configs

```
Package defaults      → auth/guest/     → Your configs
                      → auth/keycloak/  →
```

Later configurations override earlier ones, allowing you to customize only what you need.

## In This Section

- [RHDH Deployment](/guide/deployment/rhdh-deployment) - RHDHDeployment class
- [Keycloak Deployment](/guide/deployment/keycloak-deployment) - KeycloakHelper class
- [Helm Deployment](/guide/deployment/helm-deployment) - Helm-specific guide
- [Operator Deployment](/guide/deployment/operator-deployment) - Operator-specific guide
- [Authentication](/guide/deployment/authentication) - Auth providers
