> [!IMPORTANT]
> This is a community-maintained template and is not officially supported by the Lebap AI team. You could encounter issues or even deployment failures in future versions of Lebap AI. We do our best to keep this template and all community contributions backwards compatible, but we cannot guarantee it.

# OpenShift Deployment Template for Lebap AI

This directory contains a specialized Dockerfile and entrypoint script for deploying Lebap AI on **Red Hat OpenShift** clusters.

## Why This Template Exists

OpenShift has a unique security model that differs from standard Docker/Kubernetes deployments:

1. **Arbitrary UIDs**: OpenShift runs containers with randomly assigned user IDs (UIDs) that don't exist in `/etc/passwd`
2. **GID 0 Requirement**: All containers run with GID 0 (root group) as the primary group
3. **Restricted SCCs**: The default Security Context Constraints (SCCs) prevent containers from running as specific users

These requirements are incompatible with the standard Lebap AI Docker image, which uses a fixed `anythingllm` user with UID/GID 1000.

## Key Differences from Standard Dockerfile

| Feature | Standard Docker | OpenShift Template |
|---------|-----------------|-------------------|
| File ownership | `anythingllm:anythingllm` | `anythingllm:0` (root group) |
| File permissions | Standard | Group-writable (`g+w`) |
| `/etc/passwd` | Read-only | Group-writable for UID injection |
| Supplementary groups | None | Added to group 0 |
| Entrypoint | Standard | Handles arbitrary UID scenarios |

## When to Use This Template

Use this template **only** if you are deploying to:
- Red Hat OpenShift (any version)
- OKD (OpenShift Origin)
- Any Kubernetes cluster with OpenShift-style restricted SCCs

**Do NOT use this for:**
- Standard Docker deployments
- Docker Compose
- Generic Kubernetes (use the standard image with appropriate `securityContext`)
- Cloud container services (AWS ECS, Google Cloud Run, Azure Container Instances)

## Building the Image

From the repository root:

```bash
docker build -f cloud-deployments/openshift/Dockerfile -t lebap-ai:openshift .
```

For multi-architecture builds:

```bash
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -f cloud-deployments/openshift/Dockerfile \
  -t your-registry/lebap-ai:openshift \
  --push .
```

## Deploying to OpenShift

### Using `oc` CLI

```bash
# Create a new project (namespace)
oc new-project lebap-ai

# Create a deployment
oc new-app your-registry/lebap-ai:openshift

# Expose the service
oc expose svc/lebap-ai --port=3001

# Set required environment variables
oc set env deployment/lebap-ai \
  STORAGE_DIR=/app/server/storage \
  JWT_SECRET=$(openssl rand -hex 32)
```

### Using a DeploymentConfig YAML

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: lebap-ai
spec:
  replicas: 1
  selector:
    matchLabels:
      app: lebap-ai
  template:
    metadata:
      labels:
        app: lebap-ai
    spec:
      containers:
      - name: lebap-ai
        image: your-registry/lebap-ai:openshift
        ports:
        - containerPort: 3001
        env:
        - name: STORAGE_DIR
          value: /app/server/storage
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: lebap-ai-secrets
              key: jwt-secret
        volumeMounts:
        - name: storage
          mountPath: /app/server/storage
      volumes:
      - name: storage
        persistentVolumeClaim:
          claimName: lebap-ai-storage
```

## Persistent Storage

OpenShift PersistentVolumeClaims work with this image. Ensure the PVC is created before deployment:

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: lebap-ai-storage
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
```

## Troubleshooting

### Permission Denied Errors

If you see permission errors, verify:
1. You're using this OpenShift-specific image, not the standard one
2. The PVC has correct access modes
3. No custom SCCs are overriding the default behavior

### User Not Found in passwd

The entrypoint script automatically handles this by injecting a passwd entry at runtime. If issues persist, check that `/etc/passwd` is group-writable in your image.
