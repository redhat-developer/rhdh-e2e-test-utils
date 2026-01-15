# Requirements

## System Requirements

| Requirement | Version |
|-------------|---------|
| Node.js | >= 22 |
| Yarn | >= 3 (uses Corepack) |

### Enabling Corepack

This project uses Yarn 3 with Corepack. Enable it with:

```bash
corepack enable
```

## Required CLI Tools

The following binaries must be installed and available in your PATH:

| Tool | Purpose |
|------|---------|
| `oc` | OpenShift CLI for cluster operations |
| `kubectl` | Kubernetes CLI (used as fallback) |
| `helm` | Helm CLI for chart deployments |

### Installing CLI Tools

**OpenShift CLI (oc)**
```bash
# macOS
brew install openshift-cli

# Linux
curl -LO https://mirror.openshift.com/pub/openshift-v4/clients/ocp/latest/openshift-client-linux.tar.gz
tar xvzf openshift-client-linux.tar.gz
sudo mv oc /usr/local/bin/
```

**Helm**
```bash
# macOS
brew install helm

# Linux
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
```

## OpenShift Cluster Requirements

You must be logged into an OpenShift cluster with sufficient permissions to:

| Permission | Resource |
|------------|----------|
| Create/Delete | Namespaces |
| Create/Update | ConfigMaps |
| Create/Update | Secrets |
| Create/Read | Routes |
| Install | Helm charts |
| Install | RHDH Operator (if using operator method) |
| Read | Cluster ingress configuration |

### Logging into OpenShift

```bash
# Using token
oc login --server=https://api.your-cluster.com:6443 --token=your-token

# Using username/password
oc login --server=https://api.your-cluster.com:6443 -u username -p password
```

### Verifying Cluster Access

```bash
# Check cluster connection
oc whoami

# Check permissions
oc auth can-i create namespace
oc auth can-i create secret
oc auth can-i create configmap
```

## RHDH Requirements

| Component | Description |
|-----------|-------------|
| RHDH Version | Set via `RHDH_VERSION` environment variable (e.g., "1.5") |
| Helm Chart | Default: `oci://quay.io/rhdh/chart` (customizable via `CHART_URL`) |

## Keycloak Requirements (Optional)

If using Keycloak authentication:

| Component | Description |
|-----------|-------------|
| Namespace | `rhdh-keycloak` (default) |
| Helm Chart | Bitnami Keycloak chart |
| Storage | PersistentVolumeClaim for Keycloak data |

## Resource Requirements

Minimum cluster resources for running tests:

| Component | CPU | Memory |
|-----------|-----|--------|
| RHDH | 1 core | 2Gi |
| Keycloak | 0.5 core | 1Gi |
| PostgreSQL (for Keycloak) | 0.25 core | 512Mi |

## Network Requirements

| Requirement | Description |
|-------------|-------------|
| OpenShift Routes | Must be accessible from test runner |
| Ingress Domain | Automatically detected from cluster |
| HTTPS | Routes use cluster's default TLS |

## Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `RHDH_VERSION` | RHDH version to deploy | `"1.5"` |
| `INSTALLATION_METHOD` | Deployment method | `"helm"` or `"operator"` |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `SKIP_KEYCLOAK_DEPLOYMENT` | Skip Keycloak auto-deployment | `false` |
| `CHART_URL` | Custom Helm chart URL | `oci://quay.io/rhdh/chart` |
| `CI` | If set, enables auto-cleanup | - |

## Next Steps

- [Installation](/guide/installation) - Install the package
- [Quick Start](/guide/quick-start) - Create your first test
