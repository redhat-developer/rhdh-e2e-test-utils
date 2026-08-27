import path from "path";
import type { OpenLDAPDeploymentOptions } from "./types.js";

// Navigate from dist/deployment/openldap/ to package root
const PACKAGE_ROOT = path.resolve(import.meta.dirname, "../../..");

/** Default password shared by admin bind and seed user1 (matches ldap.spec pattern). */
export const DEFAULT_OPENLDAP_PASSWORD = "user1pass";

export const DEFAULT_OPENLDAP_CONFIG = {
  releaseName: "openldap",
  adminUser: "admin",
  adminPassword: DEFAULT_OPENLDAP_PASSWORD,
  baseDn: "dc=rhdh,dc=test",
  usersOu: "users",
  groupsOu: "groups",
  port: 1389,
  // Bitnami public Helm chart for OpenLDAP was removed; use the Bitnami legacy image.
  imageRepository: "bitnamilegacy/openldap",
  imageTag: "2.6.10-debian-12-r4",
};

export const DEFAULT_CONFIG_PATHS = {
  seedLdifFile: path.join(
    PACKAGE_ROOT,
    "dist/deployment/openldap/config/seed.ldif",
  ),
};

export const DEFAULT_USERS = [
  {
    uid: "user1",
    cn: "User 1",
    sn: "One",
    mail: "user1@rhdh.test",
    password: DEFAULT_OPENLDAP_PASSWORD,
  },
  {
    uid: "user2",
    cn: "User 2",
    sn: "Two",
    mail: "user2@rhdh.test",
    password: DEFAULT_OPENLDAP_PASSWORD,
  },
  {
    uid: "user3",
    cn: "User 3",
    sn: "Three",
    mail: "user3@rhdh.test",
    password: DEFAULT_OPENLDAP_PASSWORD,
  },
  {
    uid: "rhdh-admin",
    cn: "RHDH Admin",
    sn: "Admin",
    mail: "rhdh-admin@rhdh.test",
    password: DEFAULT_OPENLDAP_PASSWORD,
  },
] as const;

export function buildBindDn(
  options: Pick<OpenLDAPDeploymentOptions, "adminUser" | "baseDn"> = {},
): string {
  const adminUser = options.adminUser ?? DEFAULT_OPENLDAP_CONFIG.adminUser;
  const baseDn = options.baseDn ?? DEFAULT_OPENLDAP_CONFIG.baseDn;
  return `cn=${adminUser},${baseDn}`;
}

export function buildUsersDn(
  options: Pick<OpenLDAPDeploymentOptions, "usersOu" | "baseDn"> = {},
): string {
  const usersOu = options.usersOu ?? DEFAULT_OPENLDAP_CONFIG.usersOu;
  const baseDn = options.baseDn ?? DEFAULT_OPENLDAP_CONFIG.baseDn;
  return `ou=${usersOu},${baseDn}`;
}

export function buildGroupsDn(
  options: Pick<OpenLDAPDeploymentOptions, "groupsOu" | "baseDn"> = {},
): string {
  const groupsOu = options.groupsOu ?? DEFAULT_OPENLDAP_CONFIG.groupsOu;
  const baseDn = options.baseDn ?? DEFAULT_OPENLDAP_CONFIG.baseDn;
  return `ou=${groupsOu},${baseDn}`;
}
