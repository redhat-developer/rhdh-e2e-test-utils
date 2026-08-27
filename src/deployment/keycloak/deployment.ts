import KeycloakAdminClient from "@keycloak/keycloak-admin-client";
import { KubernetesClientHelper } from "../../utils/kubernetes-client.js";
import { $, runQuietUnlessFailure } from "../../utils/bash.js";
import {
  DEFAULT_KEYCLOAK_CONFIG,
  BITNAMI_CHART_REPO,
  BITNAMI_CHART_NAME,
  DEFAULT_CONFIG_PATHS,
  DEFAULT_RHDH_CLIENT,
  SERVICE_ACCOUNT_ROLES,
  DEFAULT_USERS,
  DEFAULT_GROUPS,
} from "./constants.js";
import type {
  KeycloakDeploymentOptions,
  KeycloakDeploymentConfig,
  KeycloakClientConfig,
  KeycloakUserConfig,
  KeycloakGroupConfig,
  KeycloakRealmConfig,
  KeycloakConnectionConfig,
  KeycloakLdapFederationConfig,
  KeycloakLdapMapperConfig,
  KeycloakProtocolMapperConfig,
  KeycloakLdapRealmOptions,
} from "./types.js";

export class KeycloakHelper {
  public k8sClient = new KubernetesClientHelper();
  public deploymentConfig: KeycloakDeploymentConfig;
  public keycloakUrl: string = "";
  public realm: string = "";
  public clientId: string = "";
  public clientSecret: string = "";
  private _adminClient: KeycloakAdminClient | null = null;

  constructor(options: KeycloakDeploymentOptions = {}) {
    this.deploymentConfig = this._buildDeploymentConfig(options);
  }

  /**
   * Deploy Keycloak using Helm and configure it for RHDH.
   */
  async deploy(): Promise<void> {
    this._log("Starting Keycloak deployment...");

    await this.k8sClient.createNamespaceIfNotExists(
      this.deploymentConfig.namespace,
    );

    await this._deployWithHelm();
    await this._createRoute();
    await this._waitForKeycloak();
    await this._initializeAdminClient();
  }

  /**
   * Check if Keycloak is already running
   */
  async isRunning(): Promise<boolean> {
    try {
      this.keycloakUrl = await this.getRouteLocation();
      const response = await fetch(`${this.keycloakUrl}/realms/master`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Configure Keycloak with realm, client, groups, and users for RHDH
   */
  async configureForRHDH(options?: {
    realm?: string;
    client?: Partial<KeycloakClientConfig>;
    groups?: KeycloakGroupConfig[];
    users?: KeycloakUserConfig[];
  }): Promise<void> {
    this._log("Configuring Keycloak for RHDH...");

    await this._ensureAdminClient();

    const realmName = options?.realm ?? DEFAULT_KEYCLOAK_CONFIG.realm;

    // Create realm
    await this.createRealm({ realm: realmName, enabled: true });

    // Create client
    const clientConfig = {
      ...DEFAULT_RHDH_CLIENT,
      ...options?.client,
    };
    await this.createClient(realmName, clientConfig);

    // Store realm and client info for external access
    this.realm = realmName;
    this.clientId = clientConfig.clientId;
    this.clientSecret = clientConfig.clientSecret;

    // Assign service account roles
    await this._assignServiceAccountRoles(realmName, clientConfig.clientId);

    // Create groups
    const groups = options?.groups ?? DEFAULT_GROUPS;
    for (const group of groups) {
      await this.createGroup(realmName, group);
    }

    // Create users
    const users = options?.users ?? DEFAULT_USERS;
    for (const user of users) {
      await this.createUser(realmName, user);
    }
  }

  /**
   * Connect to an existing Keycloak instance
   */
  async connect(config: KeycloakConnectionConfig): Promise<void> {
    this.keycloakUrl = config.baseUrl;
    this._adminClient = new KeycloakAdminClient({
      baseUrl: config.baseUrl,
      realmName: config.realm ?? "master",
    });

    if (config.username && config.password) {
      await this._adminClient.auth({
        username: config.username,
        password: config.password,
        grantType: "password",
        clientId: config.clientId ?? "admin-cli",
      });
    } else if (config.clientId && config.clientSecret) {
      await this._adminClient.auth({
        grantType: "client_credentials",
        clientId: config.clientId,
        clientSecret: config.clientSecret,
      });
    }
  }

  /**
   * Create a new realm
   */
  async createRealm(config: KeycloakRealmConfig): Promise<void> {
    await this._ensureAdminClient();

    try {
      await this._adminClient!.realms.create({
        realm: config.realm,
        displayName: config.displayName ?? config.realm,
        enabled: config.enabled ?? true,
      });
      this._log(`Created realm: ${config.realm}`);
    } catch (error) {
      if (this._isConflictError(error)) {
        this._log(`Realm ${config.realm} already exists`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Create a new client in a realm
   */
  async createClient(
    realm: string,
    config: KeycloakClientConfig,
  ): Promise<void> {
    await this._ensureAdminClient();

    try {
      this._adminClient!.setConfig({ realmName: realm });

      await this._adminClient!.clients.create({
        clientId: config.clientId,
        secret: config.clientSecret,
        name: config.name ?? config.clientId,
        description: config.description ?? "",
        redirectUris: config.redirectUris ?? ["*"],
        webOrigins: config.webOrigins ?? ["*"],
        standardFlowEnabled: config.standardFlowEnabled ?? true,
        implicitFlowEnabled: config.implicitFlowEnabled ?? true,
        directAccessGrantsEnabled: config.directAccessGrantsEnabled ?? true,
        serviceAccountsEnabled: config.serviceAccountsEnabled ?? true,
        authorizationServicesEnabled:
          config.authorizationServicesEnabled ?? true,
        publicClient: config.publicClient ?? false,
        enabled: true,
        protocol: "openid-connect",
        fullScopeAllowed: true,
        attributes: config.attributes,
        defaultClientScopes: config.defaultClientScopes,
        optionalClientScopes: config.optionalClientScopes,
      });
      this._log(`Created client: ${config.clientId}`);
    } catch (error) {
      if (this._isConflictError(error)) {
        this._log(`Client ${config.clientId} already exists`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Create a group in a realm
   */
  async createGroup(realm: string, config: KeycloakGroupConfig): Promise<void> {
    await this._ensureAdminClient();

    try {
      this._adminClient!.setConfig({ realmName: realm });
      await this._adminClient!.groups.create({
        name: config.name,
      });
      this._log(`Created group: ${config.name}`);
    } catch (error) {
      if (this._isConflictError(error)) {
        this._log(`Group ${config.name} already exists`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Create a user in a realm with optional group membership
   */
  async createUser(realm: string, config: KeycloakUserConfig): Promise<void> {
    await this._ensureAdminClient();

    try {
      this._adminClient!.setConfig({ realmName: realm });

      // Create user
      const createResponse = await this._adminClient!.users.create({
        username: config.username,
        email: config.email,
        firstName: config.firstName,
        lastName: config.lastName,
        enabled: config.enabled ?? true,
        emailVerified: config.emailVerified ?? true,
      });
      this._log(`Created user: ${config.username}`);

      const userId = createResponse.id;

      // Set password if provided
      if (config.password) {
        await this._adminClient!.users.resetPassword({
          id: userId,
          credential: {
            type: "password",
            value: config.password,
            temporary: config.temporary ?? false,
          },
        });
      }

      // Add to groups if specified
      if (config.groups?.length) {
        for (const groupName of config.groups) {
          await this._addUserToGroup(realm, userId, groupName);
        }
      }
    } catch (error) {
      if (this._isConflictError(error)) {
        this._log(`User ${config.username} already exists`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Create users and groups in a realm.
   */
  async createUsersAndGroups(
    realm: string,
    options: {
      users?: KeycloakUserConfig[];
      groups?: KeycloakGroupConfig[];
    },
  ): Promise<void> {
    await this._ensureAdminClient();
    const { groups = [], users = [] } = options;

    for (const group of groups) {
      await this.createGroup(realm, group);
    }

    for (const user of users) {
      await this.createUser(realm, user);
    }
  }

  /**
   * Get all users in a realm
   */
  async getUsers(realm: string): Promise<KeycloakUserConfig[]> {
    await this._ensureAdminClient();
    this._adminClient!.setConfig({ realmName: realm });

    const users = await this._adminClient!.users.find();
    return users.map((u) => ({
      username: u.username!,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      enabled: u.enabled,
      emailVerified: u.emailVerified,
    }));
  }

  /**
   * Get all groups in a realm
   */
  async getGroups(realm: string): Promise<KeycloakGroupConfig[]> {
    await this._ensureAdminClient();
    this._adminClient!.setConfig({ realmName: realm });

    const groups = await this._adminClient!.groups.find();
    return groups.map((g) => ({ name: g.name! }));
  }

  /**
   * Get groups for a user in a realm (user resolved by username).
   */
  async getGroupsOfUser(
    realm: string,
    username: string,
  ): Promise<KeycloakGroupConfig[]> {
    await this._ensureAdminClient();
    this._adminClient!.setConfig({ realmName: realm });

    const users = await this._adminClient!.users.find({ username });
    if (users.length === 0) {
      return [];
    }
    const user = users[0];
    const groups = await this._adminClient!.users.listGroups({
      id: user.id!,
    });
    return groups.map((g) => ({ name: g.name! }));
  }

  /**
   * Delete a user from a realm
   */
  async deleteUser(realm: string, username: string): Promise<void> {
    if (DEFAULT_USERS.some((u) => u.username === username)) {
      throw new Error(
        `Deleting default Keycloak user "${username}" is not permitted.`,
      );
    }

    await this._ensureAdminClient();
    this._adminClient!.setConfig({ realmName: realm });

    const users = await this._adminClient!.users.find({ username });
    if (users.length > 0) {
      await this._adminClient!.users.del({ id: users[0].id! });
      this._log(`Deleted user: ${username}`);
    }
  }

  /**
   * Delete a group from a realm
   */
  async deleteGroup(realm: string, groupName: string): Promise<void> {
    if (DEFAULT_GROUPS.some((g) => g.name === groupName)) {
      throw new Error(
        `Deleting default Keycloak group "${groupName}" is not permitted.`,
      );
    }

    await this._ensureAdminClient();
    this._adminClient!.setConfig({ realmName: realm });

    const groups = await this._adminClient!.groups.find({ search: groupName });
    const group = groups.find((g) => g.name === groupName);
    if (group) {
      await this._adminClient!.groups.del({ id: group.id! });
      this._log(`Deleted group: ${groupName}`);
    }
  }

  /**
   * Delete users and groups from a realm.
   */
  async deleteUsersAndGroups(
    realm: string,
    options: {
      users?: Array<KeycloakUserConfig | string>;
      groups?: Array<KeycloakGroupConfig | string>;
    },
  ): Promise<void> {
    await this._ensureAdminClient();
    const { groups = [], users = [] } = options;

    const usernames = users.map((u) =>
      typeof u === "string" ? u : u.username,
    );
    const groupNames = groups.map((g) => (typeof g === "string" ? g : g.name));

    for (const username of usernames) {
      await this.deleteUser(realm, username);
    }

    for (const groupName of groupNames) {
      await this.deleteGroup(realm, groupName);
    }
  }

  /**
   * Delete a realm
   */
  async deleteRealm(realm: string): Promise<void> {
    await this._ensureAdminClient();

    try {
      await this._adminClient!.realms.del({ realm });
      this._log(`Deleted realm: ${realm}`);
    } catch (error) {
      this._log(`Failed to delete realm ${realm}: ${error}`);
    }
  }

  /**
   * Create (or return existing) LDAP user federation component on a realm.
   * Requires admin credentials via connect()/deploy().
   */
  async createLdapUserFederation(
    realm: string,
    config: KeycloakLdapFederationConfig,
  ): Promise<string> {
    await this._ensureAdminClient();
    this._adminClient!.setConfig({ realmName: realm });

    const name = config.name ?? "openldap";
    const existing = await this.getLdapUserFederation(realm, name);
    if (existing?.id) {
      this._log(`LDAP federation ${name} already exists (${existing.id})`);
      await this.updateLdapUserFederation(existing.id, config, realm);
      return existing.id;
    }

    const realmRep = await this._adminClient!.realms.findOne({ realm });
    if (!realmRep?.id) {
      throw new Error(`Realm ${realm} not found`);
    }

    const { id } = await this._adminClient!.components.create({
      realm,
      name,
      providerId: "ldap",
      providerType: "org.keycloak.storage.UserStorageProvider",
      parentId: realmRep.id,
      config: this._ldapFederationConfigToComponent(config),
    });
    this._log(`Created LDAP federation: ${name} (${id})`);
    return id;
  }

  async getLdapUserFederation(
    realm: string,
    name?: string,
  ): Promise<{ id: string; name?: string } | undefined> {
    await this._ensureAdminClient();
    this._adminClient!.setConfig({ realmName: realm });

    const components = await this._adminClient!.components.find({
      realm,
      type: "org.keycloak.storage.UserStorageProvider",
    });
    const match = name
      ? components.find((c) => c.name === name && c.providerId === "ldap")
      : components.find((c) => c.providerId === "ldap");
    return match?.id ? { id: match.id, name: match.name } : undefined;
  }

  async updateLdapUserFederation(
    id: string,
    config: KeycloakLdapFederationConfig,
    realm: string,
  ): Promise<void> {
    await this._ensureAdminClient();
    this._adminClient!.setConfig({ realmName: realm });

    const current = await this._adminClient!.components.findOne({ id, realm });
    if (!current) {
      throw new Error(`LDAP federation component ${id} not found`);
    }

    await this._adminClient!.components.update(
      { id, realm },
      {
        ...current,
        config: {
          ...current.config,
          ...this._ldapFederationConfigToComponent(config),
        },
      },
    );
    this._log(`Updated LDAP federation: ${id}`);
  }

  async deleteLdapUserFederation(id: string, realm: string): Promise<void> {
    await this._ensureAdminClient();
    await this._adminClient!.components.del({ id, realm });
    this._log(`Deleted LDAP federation: ${id}`);
  }

  async createLdapMapper(
    realm: string,
    parentId: string,
    mapper: KeycloakLdapMapperConfig,
  ): Promise<string> {
    await this._ensureAdminClient();
    this._adminClient!.setConfig({ realmName: realm });

    const existing = await this.listLdapMappers(realm, parentId);
    const found = existing.find((m) => m.name === mapper.name);
    if (found?.id) {
      this._log(`LDAP mapper ${mapper.name} already exists`);
      return found.id;
    }

    const configEntries: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(mapper.config)) {
      configEntries[key] = [value];
    }

    const { id } = await this._adminClient!.components.create({
      realm,
      name: mapper.name,
      parentId,
      providerId: mapper.providerId,
      providerType: "org.keycloak.storage.ldap.mappers.LDAPStorageMapper",
      config: configEntries,
    });
    this._log(`Created LDAP mapper: ${mapper.name}`);
    return id;
  }

  async listLdapMappers(
    realm: string,
    parentId: string,
  ): Promise<Array<{ id?: string; name?: string }>> {
    await this._ensureAdminClient();
    return this._adminClient!.components.find({
      realm,
      parent: parentId,
      type: "org.keycloak.storage.ldap.mappers.LDAPStorageMapper",
    });
  }

  async syncLdapUsers(
    federationId: string,
    action: "triggerFullSync" | "triggerChangedUsersSync" = "triggerFullSync",
  ): Promise<void> {
    await this._ensureAdminClient();
    await this._adminClient!.userStorageProvider.sync({
      id: federationId,
      action,
    });
    this._log(`Triggered LDAP sync (${action}) for ${federationId}`);
  }

  /**
   * Add an OIDC protocol mapper on a client (e.g. ldap_uuid user attribute → claim).
   */
  async addClientProtocolMapper(
    realm: string,
    clientId: string,
    mapper: KeycloakProtocolMapperConfig,
  ): Promise<void> {
    await this._ensureAdminClient();
    this._adminClient!.setConfig({ realmName: realm });

    const clients = await this._adminClient!.clients.find({ clientId });
    if (clients.length === 0 || !clients[0].id) {
      throw new Error(`Client ${clientId} not found in realm ${realm}`);
    }
    const id = clients[0].id;

    const existing = await this._adminClient!.clients.listProtocolMappers({
      id,
      realm,
    });
    if (existing.some((m) => m.name === mapper.name)) {
      this._log(`Protocol mapper ${mapper.name} already exists on ${clientId}`);
      return;
    }

    await this._adminClient!.clients.addProtocolMapper(
      { id, realm },
      {
        name: mapper.name,
        protocol: mapper.protocol ?? "openid-connect",
        protocolMapper: mapper.protocolMapper,
        config: mapper.config,
      },
    );
    this._log(`Added protocol mapper ${mapper.name} on client ${clientId}`);
  }

  /**
   * One-shot: separate LDAP-fed realm + client + OpenLDAP federation + ldap_uuid claim.
   * Connect as Keycloak admin first (username/password), not the RHDH service account.
   */
  async configureLdapRealm(options: KeycloakLdapRealmOptions): Promise<void> {
    await this._ensureAdminClient();

    const realmName = options.realm;
    await this.createRealm({ realm: realmName, enabled: true });

    const clientConfig: KeycloakClientConfig = {
      ...DEFAULT_RHDH_CLIENT,
      clientId: "rhdh-ldap-client",
      clientSecret: "rhdh-ldap-client-secret",
      name: "RHDH LDAP Client",
      ...options.client,
    };
    await this.createClient(realmName, clientConfig);
    await this._assignServiceAccountRoles(realmName, clientConfig.clientId);

    const federationId = await this.createLdapUserFederation(
      realmName,
      options.ldap,
    );

    // Map LDAP entryUUID into a Keycloak user attribute for the token claim.
    /* eslint-disable @typescript-eslint/naming-convention -- Keycloak Admin API mapper config keys */
    const ldapUuidMapperConfig = {
      "user.model.attribute": "ldap_uuid",
      "ldap.attribute": options.ldap.uuidLdapAttribute ?? "entryUUID",
      "read.only": "true",
      "always.read.value.from.ldap": "true",
      "is.binary.attribute": "false",
    };
    const claim = options.ldapUuidClaim ?? "ldap_uuid";
    const ldapUuidClaimConfig = {
      "user.attribute": "ldap_uuid",
      "claim.name": claim,
      "jsonType.label": "String",
      "id.token.claim": "true",
      "access.token.claim": "true",
      "userinfo.token.claim": "true",
    };
    /* eslint-enable @typescript-eslint/naming-convention */

    await this.createLdapMapper(realmName, federationId, {
      name: "ldap-uuid",
      providerId: "user-attribute-ldap-mapper",
      config: ldapUuidMapperConfig,
    });

    await this.addClientProtocolMapper(realmName, clientConfig.clientId, {
      name: "ldap-uuid-claim",
      protocolMapper: "oidc-usermodel-attribute-mapper",
      config: ldapUuidClaimConfig,
    });

    await this.syncLdapUsers(federationId);

    this.realm = realmName;
    this.clientId = clientConfig.clientId;
    this.clientSecret = clientConfig.clientSecret;
    this._log(`Configured LDAP realm ${realmName}`);
  }

  /**
   * Teardown Keycloak deployment
   */
  async teardown(): Promise<void> {
    await this.k8sClient.deleteNamespace(this.deploymentConfig.namespace);
    this._log(`Keycloak deployment torn down`);
  }

  /**
   * Wait for Keycloak to be ready
   */
  async waitUntilReady(timeout: number = 500): Promise<void> {
    this._log(`Waiting for Keycloak to be ready...`);
    const labelSelector = `app.kubernetes.io/instance=${this.deploymentConfig.releaseName}`;
    await this.k8sClient.waitForPodsWithFailureDetection(
      this.deploymentConfig.namespace,
      labelSelector,
      timeout,
    );
  }

  // Private methods

  private _buildDeploymentConfig(
    options: KeycloakDeploymentOptions,
  ): KeycloakDeploymentConfig {
    return {
      namespace: options.namespace ?? DEFAULT_KEYCLOAK_CONFIG.namespace,
      releaseName: options.releaseName ?? DEFAULT_KEYCLOAK_CONFIG.releaseName,
      valuesFile: options.valuesFile ?? DEFAULT_CONFIG_PATHS.valuesFile,
      adminUser: options.adminUser ?? DEFAULT_KEYCLOAK_CONFIG.adminUser,
      adminPassword:
        options.adminPassword ?? DEFAULT_KEYCLOAK_CONFIG.adminPassword,
    };
  }

  private async _deployWithHelm(): Promise<void> {
    await $`helm repo add bitnami ${BITNAMI_CHART_REPO} || true`;
    await runQuietUnlessFailure`helm repo update`;

    await runQuietUnlessFailure`helm upgrade --install ${this.deploymentConfig.releaseName} ${BITNAMI_CHART_NAME} \
      --namespace ${this.deploymentConfig.namespace} \
      --values ${this.deploymentConfig.valuesFile}`;

    await this.waitUntilReady();
  }

  private async _createRoute(): Promise<void> {
    // Use plain HTTP route (no TLS) for test environments to avoid self-signed certificate issues
    const routeManifest = `
apiVersion: route.openshift.io/v1
kind: Route
metadata:
  name: ${this.deploymentConfig.releaseName}
  namespace: ${this.deploymentConfig.namespace}
  labels:
    app.kubernetes.io/name: keycloak
    app.kubernetes.io/instance: ${this.deploymentConfig.releaseName}
spec:
  to:
    kind: Service
    name: ${this.deploymentConfig.releaseName}
    weight: 100
  port:
    targetPort: http
  wildcardPolicy: None
`;

    await $`echo ${routeManifest} | kubectl apply -f -`;
  }

  async getRouteLocation(): Promise<string> {
    return await this.k8sClient.getRouteLocation(
      this.deploymentConfig.namespace,
      this.deploymentConfig.releaseName,
    );
  }

  private async _waitForKeycloak(): Promise<void> {
    this._log("Waiting for Keycloak API to be ready...");

    const timeout = 500;
    const startTime = Date.now();

    while (true) {
      if (await this.isRunning()) {
        break;
      }

      if ((Date.now() - startTime) / 1000 >= timeout) {
        throw new Error(`Keycloak API not ready after ${timeout} seconds`);
      }

      await new Promise((resolve) => setTimeout(resolve, 5000));
      this._log("  Waiting for Keycloak API to be ready...");
    }
  }

  private async _initializeAdminClient(): Promise<void> {
    this._adminClient = new KeycloakAdminClient({
      baseUrl: this.keycloakUrl,
      realmName: "master",
    });

    await this._adminClient.auth({
      username: this.deploymentConfig.adminUser,
      password: this.deploymentConfig.adminPassword,
      grantType: "password",
      clientId: "admin-cli",
    });
  }

  private async _ensureAdminClient(): Promise<void> {
    if (!this._adminClient) {
      throw new Error(
        "Admin client not initialized. Call deploy() or connect() first.",
      );
    }
  }

  private async _assignServiceAccountRoles(
    realm: string,
    clientId: string,
  ): Promise<void> {
    await this._ensureAdminClient();
    this._adminClient!.setConfig({ realmName: realm });

    // Get service account user
    const clients = await this._adminClient!.clients.find({ clientId });
    if (clients.length === 0) {
      throw new Error(`Client ${clientId} not found`);
    }
    const client = clients[0];

    const serviceAccountUser =
      await this._adminClient!.clients.getServiceAccountUser({
        id: client.id!,
      });

    // Get realm-management client
    const realmMgmtClients = await this._adminClient!.clients.find({
      clientId: "realm-management",
    });
    if (realmMgmtClients.length === 0) {
      throw new Error("realm-management client not found");
    }
    const realmMgmtClient = realmMgmtClients[0];

    // Get roles
    const allRoles = await this._adminClient!.clients.listRoles({
      id: realmMgmtClient.id!,
    });
    const rolesToAssign = allRoles.filter((r) =>
      SERVICE_ACCOUNT_ROLES.includes(r.name!),
    );

    if (rolesToAssign.length > 0) {
      await this._adminClient!.users.addClientRoleMappings({
        id: serviceAccountUser.id!,
        clientUniqueId: realmMgmtClient.id!,
        roles: rolesToAssign.map((r) => ({
          id: r.id!,
          name: r.name!,
        })),
      });
      this._log(
        `Assigned service account roles: ${rolesToAssign.map((r) => r.name).join(", ")}`,
      );
    }
  }

  private async _addUserToGroup(
    realm: string,
    userId: string,
    groupName: string,
  ): Promise<void> {
    this._adminClient!.setConfig({ realmName: realm });

    const groups = await this._adminClient!.groups.find({ search: groupName });
    const group = groups.find((g) => g.name === groupName);

    if (group) {
      await this._adminClient!.users.addToGroup({
        id: userId,
        groupId: group.id!,
      });
      this._log(`  Added user to group: ${groupName}`);
    } else {
      this._log(`  Warning: Group ${groupName} not found`);
    }
  }

  private _ldapFederationConfigToComponent(
    config: KeycloakLdapFederationConfig,
  ): Record<string, string[]> {
    const bool = (v: boolean | undefined, fallback: boolean) =>
      String(v ?? fallback);
    return {
      enabled: ["true"],
      priority: ["0"],
      vendor: [config.vendor ?? "other"],
      connectionUrl: [config.connectionUrl],
      bindDn: [config.bindDn],
      bindCredential: [config.bindCredential],
      usersDn: [config.usersDn],
      usernameLDAPAttribute: [config.usernameLdapAttribute ?? "uid"],
      rdnLDAPAttribute: [config.rdnLdapAttribute ?? "uid"],
      uuidLDAPAttribute: [config.uuidLdapAttribute ?? "entryUUID"],
      userObjectClasses: [
        config.userObjectClasses ?? "inetOrgPerson, organizationalPerson",
      ],
      editMode: [config.editMode ?? "READ_ONLY"],
      importEnabled: [bool(config.importEnabled, true)],
      pagination: [bool(config.pagination, true)],
      searchScope: [config.searchScope ?? "1"],
      trustEmail: [bool(config.trustEmail, true)],
      authType: ["simple"],
      syncRegistrations: ["false"],
      useTruststoreSpi: ["ldapsOnly"],
      connectionPooling: ["true"],
      cachePolicy: ["DEFAULT"],
    };
  }

  private _isConflictError(error: unknown): boolean {
    const err = error as { response?: { status?: number }; status?: number };
    return err.response?.status === 409 || err.status === 409;
  }

  private _log(...args: unknown[]): void {
    console.log("[Keycloak]", ...args);
  }
}
