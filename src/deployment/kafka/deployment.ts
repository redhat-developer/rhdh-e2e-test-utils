import { KubernetesClientHelper } from "../../utils/kubernetes-client.js";
import { $, runQuietUnlessFailure } from "../../utils/bash.js";
import { DEFAULT_KAFKA_CONFIG } from "./constants.js";
import type { KafkaDeploymentOptions, KafkaDeploymentConfig } from "./types.js";

/**
 * Kafka UBI 10.2 helper for Post-Quantum (PQC) TLS 1.3 e2e testing.
 */
export class KafkaDeployment {
  public k8sClient = new KubernetesClientHelper();
  public deploymentConfig: KafkaDeploymentConfig;
  public bootstrapUrl = "";

  constructor(options: KafkaDeploymentOptions = {}) {
    this.deploymentConfig = this._buildDeploymentConfig(options);
  }

  async deploy(namespace: string): Promise<void> {
    this.deploymentConfig.namespace = namespace;
    console.info(
      `[KafkaDeployment] Starting Kafka deployment in ${namespace}...`,
    );

    await this.k8sClient.createNamespaceIfNotExists(namespace);
    await this._applyManifests();
    await this.waitUntilReady();
    this.bootstrapUrl = this.getTlsServiceUrl();
    console.info(`[KafkaDeployment] Kafka TLS ready at ${this.bootstrapUrl}`);
  }

  getTlsServiceUrl(): string {
    const { releaseName, namespace, tlsPort } = this.deploymentConfig;
    return `${releaseName}.${namespace}.svc.cluster.local:${tlsPort}`;
  }

  getPlainServiceUrl(): string {
    const { releaseName, namespace, plainPort } = this.deploymentConfig;
    return `${releaseName}.${namespace}.svc.cluster.local:${plainPort}`;
  }

  async waitUntilReady(timeout = 300): Promise<void> {
    const { namespace, releaseName } = this.deploymentConfig;
    console.info("[KafkaDeployment] Waiting for Kafka pods...");
    const labelSelector = `app.kubernetes.io/name=kafka-pq,app.kubernetes.io/instance=${releaseName}`;
    await this.k8sClient.waitForPodsWithFailureDetection(
      namespace,
      labelSelector,
      timeout,
    );
  }

  async teardown(): Promise<void> {
    const { namespace, releaseName } = this.deploymentConfig;
    console.info(
      `[KafkaDeployment] Tearing down Kafka ${releaseName} in ${namespace}...`,
    );
    await $`kubectl delete deployment,svc -l app.kubernetes.io/instance=${releaseName} -n ${namespace} --ignore-not-found=true`.nothrow();
  }

  private _buildDeploymentConfig(
    options: KafkaDeploymentOptions,
  ): KafkaDeploymentConfig {
    return {
      namespace: "",
      releaseName: options.releaseName ?? DEFAULT_KAFKA_CONFIG.releaseName,
      imageRepository:
        options.imageRepository ?? DEFAULT_KAFKA_CONFIG.imageRepository,
      imageTag: options.imageTag ?? DEFAULT_KAFKA_CONFIG.imageTag,
      plainPort: options.plainPort ?? DEFAULT_KAFKA_CONFIG.plainPort,
      tlsPort: options.tlsPort ?? DEFAULT_KAFKA_CONFIG.tlsPort,
      controllerPort:
        options.controllerPort ?? DEFAULT_KAFKA_CONFIG.controllerPort,
    };
  }

  private async _applyManifests(): Promise<void> {
    const cfg = this.deploymentConfig;
    const manifest = `
apiVersion: v1
kind: Service
metadata:
  name: ${cfg.releaseName}
  namespace: ${cfg.namespace}
  labels:
    app.kubernetes.io/name: kafka-pq
    app.kubernetes.io/instance: ${cfg.releaseName}
spec:
  type: ClusterIP
  selector:
    app.kubernetes.io/name: kafka-pq
    app.kubernetes.io/instance: ${cfg.releaseName}
  ports:
    - name: plain
      port: ${cfg.plainPort}
      targetPort: 9092
    - name: tls
      port: ${cfg.tlsPort}
      targetPort: 9093
    - name: controller
      port: ${cfg.controllerPort}
      targetPort: 9094
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${cfg.releaseName}
  namespace: ${cfg.namespace}
  labels:
    app.kubernetes.io/name: kafka-pq
    app.kubernetes.io/instance: ${cfg.releaseName}
spec:
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: kafka-pq
      app.kubernetes.io/instance: ${cfg.releaseName}
  template:
    metadata:
      labels:
        app.kubernetes.io/name: kafka-pq
        app.kubernetes.io/instance: ${cfg.releaseName}
    spec:
      containers:
        - name: kafka
          image: ${cfg.imageRepository}:${cfg.imageTag}
          imagePullPolicy: IfNotPresent
          ports:
            - name: plain
              containerPort: 9092
            - name: tls
              containerPort: 9093
            - name: controller
              containerPort: 9094
          securityContext:
            allowPrivilegeEscalation: false
            capabilities:
              drop: ["ALL"]
            runAsNonRoot: true
          env:
            - name: KAFKA_NODE_ID
              value: "1"
          resources:
            requests:
              cpu: 100m
              memory: 512Mi
            limits:
              cpu: 1000m
              memory: 2Gi
`;

    await runQuietUnlessFailure`echo ${manifest} | kubectl apply -f -`;
  }
}
