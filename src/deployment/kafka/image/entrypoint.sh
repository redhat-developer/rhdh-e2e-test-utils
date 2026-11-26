#!/usr/bin/env bash
set -euo pipefail

echo "[kafka-ubi10] Starting Kafka on UBI 10.2 (OpenSSL $(openssl version))..."

cd /opt/kafka

# Generate self-signed TLS keystore/truststore if not present
if [ ! -f /certs/server.keystore.jks ]; then
  echo "[kafka-ubi10] Generating TLS keystore and truststore (TLSv1.3)..."
  keytool -genkeypair -alias localhost -keyalg RSA -keysize 2048 -validity 365 \
    -keystore /certs/server.keystore.jks -storepass changeit -keypass changeit \
    -dname "CN=localhost, OU=Test, O=RHDH, L=RedHat, C=US" 2>/dev/null || true
  keytool -export -alias localhost -keystore /certs/server.keystore.jks \
    -file /certs/server.crt -storepass changeit 2>/dev/null || true
  keytool -import -noprompt -alias localhost -file /certs/server.crt \
    -keystore /certs/server.truststore.jks -storepass changeit 2>/dev/null || true
fi

# Configure server.properties for TLS 1.3 and clean listeners
CONF="config/kraft/server.properties"
KAFKA_HOST="${KAFKA_ADVERTISED_HOST:-kafka-pq}"

if ! grep -q "ssl.protocol=TLSv1.3" "${CONF}"; then
  sed -i '/^listeners=/d' "${CONF}"
  sed -i '/^advertised.listeners=/d' "${CONF}"
  sed -i '/^controller.quorum.voters=/d' "${CONF}"

  cat >>"${CONF}" <<EOF

# Custom KRaft and TLS 1.3 Configuration
listeners=PLAINTEXT://0.0.0.0:9092,SSL://0.0.0.0:9093,CONTROLLER://127.0.0.1:9094
advertised.listeners=PLAINTEXT://${KAFKA_HOST}:9092,SSL://${KAFKA_HOST}:9093
controller.quorum.voters=1@127.0.0.1:9094

ssl.protocol=TLSv1.3
ssl.enabled.protocols=TLSv1.3
ssl.keystore.location=/certs/server.keystore.jks
ssl.keystore.password=changeit
ssl.key.password=changeit
ssl.truststore.location=/certs/server.truststore.jks
ssl.truststore.password=changeit
ssl.client.auth=none
EOF
fi

# Format KRaft storage if metadata log dir is empty
if [ ! -f "${KAFKA_LOG_DIRS}/meta.properties" ]; then
  echo "[kafka-ubi10] Formatting KRaft storage..."
  CLUSTER_ID="${KAFKA_CLUSTER_ID:-$(bin/kafka-storage.sh random-uuid)}"
  bin/kafka-storage.sh format -t "${CLUSTER_ID}" -c config/kraft/server.properties --ignore-formatted
fi

# Start Kafka broker in KRaft mode
exec bin/kafka-server-start.sh config/kraft/server.properties
