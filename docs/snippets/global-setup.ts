import { RHDHDeployment } from "rhdh-e2e-test-utils/rhdh";

async function globalSetup() {
  const deployment = new RHDHDeployment({
    appConfig: "tests/config/app-config-rhdh.yaml",
    dynamicPlugins: "tests/config/dynamic-plugins.yaml",
    secrets: "tests/config/rhdh-secrets.yaml",
    auth: "keycloak", // or "guest"
  });

  await deployment.deploy();
  await deployment.waitForDeployment();
}

export default globalSetup;
