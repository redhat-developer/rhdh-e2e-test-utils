export type OpenLDAPDeploymentOptions = {
  releaseName?: string;
  adminUser?: string;
  adminPassword?: string;
  baseDn?: string;
  usersOu?: string;
  groupsOu?: string;
  port?: number;
  imageRepository?: string;
  imageTag?: string;
  valuesFile?: string;
  seedLdifFile?: string;
};

export type OpenLDAPDeploymentConfig = {
  namespace: string;
  releaseName: string;
  adminUser: string;
  adminPassword: string;
  baseDn: string;
  usersOu: string;
  groupsOu: string;
  port: number;
  imageRepository: string;
  imageTag: string;
  seedLdifFile: string;
};

export type OpenLDAPBindConfig = {
  bindDn: string;
  bindSecret: string;
  usersDn: string;
  groupsDn: string;
  baseDn: string;
};
