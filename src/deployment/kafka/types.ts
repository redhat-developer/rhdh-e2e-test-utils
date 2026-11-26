export interface KafkaDeploymentOptions {
  releaseName?: string;
  imageRepository?: string;
  imageTag?: string;
  plainPort?: number;
  tlsPort?: number;
  controllerPort?: number;
}

export interface KafkaDeploymentConfig {
  namespace: string;
  releaseName: string;
  imageRepository: string;
  imageTag: string;
  plainPort: number;
  tlsPort: number;
  controllerPort: number;
}
