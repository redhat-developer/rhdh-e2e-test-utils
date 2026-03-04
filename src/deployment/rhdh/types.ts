export type DeploymentMethod = "helm" | "operator";
export type AuthProvider = "guest" | "keycloak" | "github";

export type DeploymentOptions = {
  version?: string;
  namespace?: string;
  auth?: AuthProvider;
  appConfig?: string;
  secrets?: string;
  dynamicPlugins?: string;
  method?: DeploymentMethod;
  valueFile?: string;
  subscription?: string;
};

export type HelmDeploymentConfig = {
  method: "helm";
  valueFile: string;
};

export type OperatorDeploymentConfig = {
  method: "operator";
  subscription: string;
};

export type DeploymentConfigBase = {
  version: string;
  namespace: string;
  auth: AuthProvider;
  appConfig: string;
  secrets: string;
  dynamicPlugins: string;
};

export type DeploymentConfig = DeploymentConfigBase &
  (HelmDeploymentConfig | OperatorDeploymentConfig);
