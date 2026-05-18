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
  disableWrappers?: string[];
  /** When true, merge new-frontend-system (app-next) layers. When omitted, auto-detect: namespace ends with `-app-next` or `USE_NEW_FRONTEND_SYSTEM=true`. Pass false to disable. */
  useNewFrontendSystem?: boolean;
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
  disableWrappers: string[];
  /** New frontend system (Backstage app-next / NFS shell). */
  useNewFrontendSystem: boolean;
};

export type DeploymentConfig = DeploymentConfigBase &
  (HelmDeploymentConfig | OperatorDeploymentConfig);
