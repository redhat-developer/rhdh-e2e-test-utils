#!/usr/bin/env bash
#
# Helper script to download Kafka tarball (with resume support),
# build the linux/amd64 UBI 10.2 image, and optionally push to registry.
#
# Usage:
#   ./build-image.sh [--push] [--tag <image-tag>] [--platform <platform>]
#
# Examples:
#   ./build-image.sh
#   ./build-image.sh --push
#   ./build-image.sh --push --tag quay.io/aandriienko/kafka-ubi10.2:latest
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

KAFKA_VERSION="${KAFKA_VERSION:-3.9.0}"
SCALA_VERSION="${SCALA_VERSION:-2.13}"
TARBALL="kafka_${SCALA_VERSION}-${KAFKA_VERSION}.tgz"
DOWNLOAD_URL="https://archive.apache.org/dist/kafka/${KAFKA_VERSION}/${TARBALL}"

TAG="quay.io/aandriienko/kafka-ubi10.2:latest"
PLATFORM="linux/amd64"
DO_PUSH=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --push)
      DO_PUSH=true
      shift
      ;;
    --tag)
      TAG="$2"
      shift 2
      ;;
    --platform)
      PLATFORM="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: $0 [--push] [--tag <tag>] [--platform <platform>]"
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

echo "==> Checking Kafka tarball (${TARBALL})..."
if [[ ! -f "${TARBALL}" ]]; then
  echo "==> Downloading Kafka ${KAFKA_VERSION} from Apache Archive..."
  curl -C - -L --retry 5 --retry-delay 3 "${DOWNLOAD_URL}" -o "${TARBALL}"
else
  echo "==> Tarball already exists: $(ls -lh "${TARBALL}" | awk '{print $5}')"
fi

echo "==> Building image: ${TAG} (platform: ${PLATFORM})..."
docker buildx build \
  --load \
  --platform "${PLATFORM}" \
  -t "${TAG}" \
  -f Containerfile .

echo "==> Build successful: ${TAG}"

if [[ "${DO_PUSH}" == "true" ]]; then
  echo "==> Pushing image to registry: ${TAG}..."
  docker push "${TAG}"
  echo "==> Image pushed successfully: ${TAG}"
else
  echo "==> Skipping push. Pass --push to push to registry."
fi
