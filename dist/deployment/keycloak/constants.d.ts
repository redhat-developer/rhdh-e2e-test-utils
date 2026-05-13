import type { KeycloakClientConfig } from "./types.js";
export declare const DEFAULT_KEYCLOAK_CONFIG: {
    namespace: string;
    releaseName: string;
    adminUser: string;
    adminPassword: string;
    realm: string;
};
export declare const DEFAULT_CONFIG_PATHS: {
    valuesFile: string;
};
export declare const BITNAMI_CHART_REPO = "https://charts.bitnami.com/bitnami";
export declare const BITNAMI_CHART_NAME = "bitnami/keycloak";
export declare const DEFAULT_RHDH_CLIENT: KeycloakClientConfig;
export declare const DEFAULT_GROUPS: {
    name: string;
}[];
export declare const DEFAULT_USERS: {
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    enabled: boolean;
    emailVerified: boolean;
    password: string;
    groups: string[];
}[];
export declare const SERVICE_ACCOUNT_ROLES: string[];
//# sourceMappingURL=constants.d.ts.map