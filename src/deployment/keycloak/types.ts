export type KeycloakDeploymentOptions = {
  namespace?: string;
  releaseName?: string;
  valuesFile?: string;
  adminUser?: string;
  adminPassword?: string;
};

export type KeycloakDeploymentConfig = {
  namespace: string;
  releaseName: string;
  valuesFile: string;
  adminUser: string;
  adminPassword: string;
};

export type KeycloakClientConfig = {
  clientId: string;
  clientSecret: string;
  name?: string;
  description?: string;
  redirectUris?: string[];
  webOrigins?: string[];
  standardFlowEnabled?: boolean;
  implicitFlowEnabled?: boolean;
  directAccessGrantsEnabled?: boolean;
  serviceAccountsEnabled?: boolean;
  authorizationServicesEnabled?: boolean;
  publicClient?: boolean;
  attributes?: Record<string, string>;
  defaultClientScopes?: string[];
  optionalClientScopes?: string[];
};

export type KeycloakUserConfig = {
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  enabled?: boolean;
  emailVerified?: boolean;
  password?: string;
  temporary?: boolean;
  groups?: string[];
};

export type KeycloakGroupConfig = {
  name: string;
};

export type KeycloakRealmConfig = {
  realm: string;
  displayName?: string;
  enabled?: boolean;
};

export type KeycloakConnectionConfig = {
  baseUrl: string;
  realm?: string;
  clientId?: string;
  clientSecret?: string;
  username?: string;
  password?: string;
};
