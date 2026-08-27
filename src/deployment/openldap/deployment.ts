import * as fs from "fs";
import { KubernetesClientHelper } from "../../utils/kubernetes-client.js";
import { $, runQuietUnlessFailure } from "../../utils/bash.js";
import {
  DEFAULT_OPENLDAP_CONFIG,
  DEFAULT_CONFIG_PATHS,
  buildBindDn,
  buildUsersDn,
  buildGroupsDn,
} from "./constants.js";
import type {
  OpenLDAPDeploymentOptions,
  OpenLDAPDeploymentConfig,
  OpenLDAPBindConfig,
} from "./types.js";

/**
 * Orchestrator-style OpenLDAP helper (Bitnami legacy image).
 * Call from test.runOnce — not globalSetup. Deploys into the Playwright project namespace.
 */
export class OpenLDAPHelper {
  public k8sClient = new KubernetesClientHelper();
  public deploymentConfig: OpenLDAPDeploymentConfig;
  public ldapUrl = "";

  constructor(options: OpenLDAPDeploymentOptions = {}) {
    this.deploymentConfig = this._buildDeploymentConfig(options);
  }

  /**
   * Deploy OpenLDAP into the given namespace (creates namespace if needed).
   */
  async deploy(namespace: string): Promise<void> {
    this.deploymentConfig.namespace = namespace;
    this._log(`Starting OpenLDAP deployment in ${namespace}...`);

    await this.k8sClient.createNamespaceIfNotExists(namespace);
    await this._applyManifests();
    await this.waitUntilReady();
    this.ldapUrl = this.getServiceUrl();
    this._log(`OpenLDAP ready at ${this.ldapUrl}`);
  }

  /**
   * True if the OpenLDAP service already exists in the configured namespace.
   */
  async isRunning(): Promise<boolean> {
    const { namespace, releaseName } = this.deploymentConfig;
    if (!namespace) {
      return false;
    }
    try {
      const result =
        await $`kubectl get svc ${releaseName} -n ${namespace} -o name`.nothrow();
      return result.exitCode === 0;
    } catch {
      return false;
    }
  }

  /** Cluster-internal LDAP URL (Keycloak federation / RHDH ldapOrg). */
  getServiceUrl(): string {
    const { releaseName, namespace, port } = this.deploymentConfig;
    if (!namespace) {
      throw new Error(
        "OpenLDAP namespace is not set — call deploy(namespace) first",
      );
    }
    return `ldap://${releaseName}.${namespace}.svc.cluster.local:${port}`;
  }

  getBindConfig(): OpenLDAPBindConfig {
    const { adminPassword, baseDn, adminUser, usersOu, groupsOu } =
      this.deploymentConfig;
    return {
      bindDn: buildBindDn({ adminUser, baseDn }),
      bindSecret: adminPassword,
      usersDn: buildUsersDn({ usersOu, baseDn }),
      groupsDn: buildGroupsDn({ groupsOu, baseDn }),
      baseDn,
    };
  }

  /** Export LDAP_* env vars for RHDH secrets / app-config substitution. */
  exportEnv(): void {
    const bind = this.getBindConfig();
    process.env.LDAP_TARGET_URL = this.getServiceUrl();
    process.env.LDAP_BIND_DN = bind.bindDn;
    process.env.LDAP_BIND_SECRET = bind.bindSecret;
    process.env.LDAP_USERS_DN = bind.usersDn;
    process.env.LDAP_GROUPS_DN = bind.groupsDn;
  }

  async waitUntilReady(timeout = 300): Promise<void> {
    const { namespace, releaseName } = this.deploymentConfig;
    this._log("Waiting for OpenLDAP pods...");
    const labelSelector = `app.kubernetes.io/name=openldap,app.kubernetes.io/instance=${releaseName}`;
    await this.k8sClient.waitForPodsWithFailureDetection(
      namespace,
      labelSelector,
      timeout,
    );
  }

  async teardown(): Promise<void> {
    const { namespace, releaseName } = this.deploymentConfig;
    this._log(`Tearing down OpenLDAP ${releaseName} in ${namespace}...`);
    await $`kubectl delete deployment,svc,configmap -l app.kubernetes.io/instance=${releaseName} -n ${namespace} --ignore-not-found=true`.nothrow();
  }

  private _buildDeploymentConfig(
    options: OpenLDAPDeploymentOptions,
  ): OpenLDAPDeploymentConfig {
    return {
      namespace: "",
      releaseName: options.releaseName ?? DEFAULT_OPENLDAP_CONFIG.releaseName,
      adminUser: options.adminUser ?? DEFAULT_OPENLDAP_CONFIG.adminUser,
      adminPassword:
        options.adminPassword ?? DEFAULT_OPENLDAP_CONFIG.adminPassword,
      baseDn: options.baseDn ?? DEFAULT_OPENLDAP_CONFIG.baseDn,
      usersOu: options.usersOu ?? DEFAULT_OPENLDAP_CONFIG.usersOu,
      groupsOu: options.groupsOu ?? DEFAULT_OPENLDAP_CONFIG.groupsOu,
      port: options.port ?? DEFAULT_OPENLDAP_CONFIG.port,
      imageRepository:
        options.imageRepository ?? DEFAULT_OPENLDAP_CONFIG.imageRepository,
      imageTag: options.imageTag ?? DEFAULT_OPENLDAP_CONFIG.imageTag,
      seedLdifFile: options.seedLdifFile ?? DEFAULT_CONFIG_PATHS.seedLdifFile,
    };
  }

  private async _applyManifests(): Promise<void> {
    const cfg = this.deploymentConfig;
    if (!fs.existsSync(cfg.seedLdifFile)) {
      throw new Error(`OpenLDAP seed LDIF not found: ${cfg.seedLdifFile}`);
    }

    const seedContent = fs.readFileSync(cfg.seedLdifFile, "utf-8");
    const manifest = `
apiVersion: v1
kind: ConfigMap
metadata:
  name: ${cfg.releaseName}-seed
  namespace: ${cfg.namespace}
  labels:
    app.kubernetes.io/name: openldap
    app.kubernetes.io/instance: ${cfg.releaseName}
data:
  seed.ldif: |
${seedContent
  .split("\n")
  .map((line) => `    ${line}`)
  .join("\n")}
---
apiVersion: v1
kind: Service
metadata:
  name: ${cfg.releaseName}
  namespace: ${cfg.namespace}
  labels:
    app.kubernetes.io/name: openldap
    app.kubernetes.io/instance: ${cfg.releaseName}
spec:
  type: ClusterIP
  selector:
    app.kubernetes.io/name: openldap
    app.kubernetes.io/instance: ${cfg.releaseName}
  ports:
    - name: ldap
      port: ${cfg.port}
      targetPort: ldap
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${cfg.releaseName}
  namespace: ${cfg.namespace}
  labels:
    app.kubernetes.io/name: openldap
    app.kubernetes.io/instance: ${cfg.releaseName}
spec:
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: openldap
      app.kubernetes.io/instance: ${cfg.releaseName}
  template:
    metadata:
      labels:
        app.kubernetes.io/name: openldap
        app.kubernetes.io/instance: ${cfg.releaseName}
    spec:
      containers:
        - name: openldap
          image: ${cfg.imageRepository}:${cfg.imageTag}
          imagePullPolicy: IfNotPresent
          ports:
            - name: ldap
              containerPort: ${cfg.port}
          # Bitnami slapd/slappasswd carry setcap CAP_NET_BIND_SERVICE; OpenShift
          # restricted-v2 drops ALL capabilities unless NET_BIND_SERVICE is added
          # explicitly (otherwise: "slappasswd: Operation not permitted").
          securityContext:
            allowPrivilegeEscalation: false
            capabilities:
              drop: ["ALL"]
              add: ["NET_BIND_SERVICE"]
            runAsNonRoot: true
          env:
            - name: LDAP_ROOT
              value: "${cfg.baseDn}"
            - name: LDAP_ADMIN_USERNAME
              value: "${cfg.adminUser}"
            - name: LDAP_ADMIN_PASSWORD
              value: "${cfg.adminPassword}"
            - name: LDAP_PORT_NUMBER
              value: "${cfg.port}"
            - name: LDAP_CUSTOM_LDIF_DIR
              value: /ldifs
            - name: LDAP_ALLOW_ANON_BINDING
              value: "no"
          volumeMounts:
            - name: seed
              mountPath: /ldifs
              readOnly: true
          readinessProbe:
            tcpSocket:
              port: ldap
            initialDelaySeconds: 10
            periodSeconds: 5
            failureThreshold: 12
          livenessProbe:
            tcpSocket:
              port: ldap
            initialDelaySeconds: 30
            periodSeconds: 10
            failureThreshold: 6
          resources:
            requests:
              cpu: 50m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 512Mi
      volumes:
        - name: seed
          configMap:
            name: ${cfg.releaseName}-seed
`;

    await runQuietUnlessFailure`echo ${manifest} | kubectl apply -f -`;
  }

  private _log(message: string): void {
    console.log(`[OpenLDAP] ${message}`);
  }
}
