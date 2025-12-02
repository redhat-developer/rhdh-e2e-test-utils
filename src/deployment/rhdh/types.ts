export type DeploymentMethod = "helm" | "operator";

export type DeploymentOptions = {
  version?: string;
  namespace: string;
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
  appConfig: string;
  secrets: string;
  dynamicPlugins: string;
};

export type DeploymentConfig = DeploymentConfigBase &
  (HelmDeploymentConfig | OperatorDeploymentConfig);
