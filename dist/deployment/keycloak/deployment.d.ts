import { KubernetesClientHelper } from "../../utils/kubernetes-client.js";
import type { KeycloakDeploymentOptions, KeycloakDeploymentConfig, KeycloakClientConfig, KeycloakUserConfig, KeycloakGroupConfig, KeycloakRealmConfig, KeycloakConnectionConfig } from "./types.js";
export declare class KeycloakHelper {
    k8sClient: KubernetesClientHelper;
    deploymentConfig: KeycloakDeploymentConfig;
    keycloakUrl: string;
    realm: string;
    clientId: string;
    clientSecret: string;
    private _adminClient;
    constructor(options?: KeycloakDeploymentOptions);
    /**
     * Deploy Keycloak using Helm and configure it for RHDH.
     */
    deploy(): Promise<void>;
    /**
     * Check if Keycloak is already running
     */
    isRunning(): Promise<boolean>;
    /**
     * Configure Keycloak with realm, client, groups, and users for RHDH
     */
    configureForRHDH(options?: {
        realm?: string;
        client?: Partial<KeycloakClientConfig>;
        groups?: KeycloakGroupConfig[];
        users?: KeycloakUserConfig[];
    }): Promise<void>;
    /**
     * Connect to an existing Keycloak instance
     */
    connect(config: KeycloakConnectionConfig): Promise<void>;
    /**
     * Create a new realm
     */
    createRealm(config: KeycloakRealmConfig): Promise<void>;
    /**
     * Create a new client in a realm
     */
    createClient(realm: string, config: KeycloakClientConfig): Promise<void>;
    /**
     * Create a group in a realm
     */
    createGroup(realm: string, config: KeycloakGroupConfig): Promise<void>;
    /**
     * Create a user in a realm with optional group membership
     */
    createUser(realm: string, config: KeycloakUserConfig): Promise<void>;
    /**
     * Create users and groups in a realm.
     */
    createUsersAndGroups(realm: string, options: {
        users?: KeycloakUserConfig[];
        groups?: KeycloakGroupConfig[];
    }): Promise<void>;
    /**
     * Get all users in a realm
     */
    getUsers(realm: string): Promise<KeycloakUserConfig[]>;
    /**
     * Get all groups in a realm
     */
    getGroups(realm: string): Promise<KeycloakGroupConfig[]>;
    /**
     * Get groups for a user in a realm (user resolved by username).
     */
    getGroupsOfUser(realm: string, username: string): Promise<KeycloakGroupConfig[]>;
    /**
     * Delete a user from a realm
     */
    deleteUser(realm: string, username: string): Promise<void>;
    /**
     * Delete a group from a realm
     */
    deleteGroup(realm: string, groupName: string): Promise<void>;
    /**
     * Delete users and groups from a realm.
     */
    deleteUsersAndGroups(realm: string, options: {
        users?: Array<KeycloakUserConfig | string>;
        groups?: Array<KeycloakGroupConfig | string>;
    }): Promise<void>;
    /**
     * Delete a realm
     */
    deleteRealm(realm: string): Promise<void>;
    /**
     * Teardown Keycloak deployment
     */
    teardown(): Promise<void>;
    /**
     * Wait for Keycloak to be ready
     */
    waitUntilReady(timeout?: number): Promise<void>;
    private _buildDeploymentConfig;
    private _deployWithHelm;
    private _createRoute;
    getRouteLocation(): Promise<string>;
    private _waitForKeycloak;
    private _initializeAdminClient;
    private _ensureAdminClient;
    private _assignServiceAccountRoles;
    private _addUserToGroup;
    private _isConflictError;
    private _log;
}
//# sourceMappingURL=deployment.d.ts.map