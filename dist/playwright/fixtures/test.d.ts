import { RHDHDeployment } from "../../deployment/rhdh/index.js";
import { LoginHelper, UIhelper } from "../helpers/index.js";
import { runOnce } from "../run-once.js";
type RHDHDeploymentTestFixtures = {
    rhdh: RHDHDeployment;
    uiHelper: UIhelper;
    loginHelper: LoginHelper;
    autoAnnotations: void;
};
type RHDHDeploymentWorkerFixtures = {
    rhdhDeploymentWorker: RHDHDeployment;
};
export declare const test: import("playwright/test").TestType<import("playwright/test").PlaywrightTestArgs & import("playwright/test").PlaywrightTestOptions & RHDHDeploymentTestFixtures, import("playwright/test").PlaywrightWorkerArgs & import("playwright/test").PlaywrightWorkerOptions & RHDHDeploymentWorkerFixtures> & {
    runOnce: typeof runOnce;
};
export * from "@playwright/test";
//# sourceMappingURL=test.d.ts.map