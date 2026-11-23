# Kafka UBI 10.2 Image for Post-Quantum (PQ) TLS Testing

Container sources for the Kafka peer used by RHDH Orchestrator / PQC e2e.

**Published image:** `quay.io/aandriienko/kafka-ubi10.2:latest`

## Why this image exists

Standard Kafka images are based on UBI 9. To test Kafka communication secured with Post-Quantum TLS 1.3 (leveraging OpenSSL 3.5.5+ and ML-KEM on UBI 10.2), this custom Kafka image packages Apache Kafka with Java 21, TLS 1.3 listener on port 9093, and OpenSSL 3.5.x on UBI 10.2.

## Files

| File             | Role                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| `build-image.sh` | Downloads tarball (with resume), builds `linux/amd64` image, and optionally pushes                |
| `Containerfile`  | Multi-stage build on UBI 10.2 with OpenSSL 3.5.x and Java 21                                      |
| `entrypoint.sh`  | Generates self-signed TLS 1.3 keystore, configures listeners, formats KRaft storage, starts Kafka |
| `openssl-pq.cnf` | OpenSSL configuration enforcing hybrid ML-KEM groups (`X25519MLKEM768:MLKEM768`)                  |

## Build and push

Using the build script (handles downloading tarball with resume, multi-arch build, and registry push):

```bash
# Build locally
./build-image.sh

# Build and push to registry
./build-image.sh --push

# Custom tag or platform
./build-image.sh --push --tag quay.io/aandriienko/kafka-ubi10.2:latest --platform linux/amd64
```

## Defaults

| Setting         | Value                           |
| --------------- | ------------------------------- |
| Plain Port      | `9092`                          |
| TLS 1.3 Port    | `9093`                          |
| Controller Port | `9094`                          |
| TLS Protocol    | `TLSv1.3`                       |
| User            | UID `1001` (OpenShift-friendly) |
