import path from "path";
import type { KeycloakClientConfig } from "./types.js";

// Navigate from dist/deployment/keycloak/ to package root
const PACKAGE_ROOT = path.resolve(import.meta.dirname, "../../..");

export const DEFAULT_KEYCLOAK_CONFIG = {
  namespace: "rhdh-keycloak",
  releaseName: "keycloak",
  adminUser: "admin",
  adminPassword: "admin123",
  realm: "rhdh",
};

export const DEFAULT_CONFIG_PATHS = {
  valuesFile: path.join(
    PACKAGE_ROOT,
    "dist/deployment/keycloak/config/keycloak-values.yaml",
  ),
};

export const BITNAMI_CHART_REPO = "https://charts.bitnami.com/bitnami";
export const BITNAMI_CHART_NAME = "bitnami/keycloak";

export const DEFAULT_RHDH_CLIENT: KeycloakClientConfig = {
  clientId: "rhdh-client",
  clientSecret: "rhdh-client-secret",
  name: "RHDH Client",
  redirectUris: ["*"],
  webOrigins: ["*"],
  standardFlowEnabled: true,
  implicitFlowEnabled: true,
  directAccessGrantsEnabled: true,
  serviceAccountsEnabled: true,
  authorizationServicesEnabled: true,
  publicClient: false,
  defaultClientScopes: [
    "service_account",
    "web-origins",
    "roles",
    "profile",
    "basic",
    "email",
  ],
  optionalClientScopes: [
    "address",
    "phone",
    "offline_access",
    "microprofile-jwt",
  ],
};

export const DEFAULT_GROUPS = [
  { name: "developers" },
  { name: "admins" },
  { name: "viewers" },
];

export const DEFAULT_USERS = [
  {
    username: "test1",
    email: "test1@example.com",
    firstName: "Test",
    lastName: "User1",
    enabled: true,
    emailVerified: true,
    password: "test1@123",
    groups: ["developers"],
  },
  {
    username: "test2",
    email: "test2@example.com",
    firstName: "Test",
    lastName: "User2",
    enabled: true,
    emailVerified: true,
    password: "test2@123",
    groups: ["developers"],
  },
];

// Service account roles required for RHDH integration
export const SERVICE_ACCOUNT_ROLES = [
  "view-authorization",
  "manage-authorization",
  "view-users",
];
