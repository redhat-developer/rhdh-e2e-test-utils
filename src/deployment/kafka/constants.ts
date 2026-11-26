export const DEFAULT_KAFKA_CONFIG = {
  releaseName: "kafka-pq",
  imageRepository: "quay.io/aandriienko/kafka-ubi10.2",
  imageTag: "latest",
  plainPort: 9092,
  tlsPort: 9093,
  controllerPort: 9094,
};
