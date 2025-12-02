import { RHDHDeployment } from "../../deployment/rhdh/index.js";
import { test as base } from "@playwright/test";
export const test = base.extend({
    rhdhDeploymentWorker: [
        // eslint-disable-next-line no-empty-pattern
        async ({}, use, workerInfo) => {
            console.log(`Deploying rhdh for plugin ${workerInfo.project.name} in namespace ${workerInfo.project.name}`);
            const rhdhDeployment = new RHDHDeployment({
                namespace: workerInfo.project.name,
            });
            try {
                await use(rhdhDeployment);
            }
            finally {
                if (process.env.CI) {
                    console.log(`Deleting namespace ${workerInfo.project.name}`);
                    await rhdhDeployment.teardown();
                }
            }
        },
        { scope: "worker", auto: true },
    ],
    rhdh: [
        async ({ rhdhDeploymentWorker }, use) => {
            await use(rhdhDeploymentWorker);
        },
        { auto: true, scope: "test" },
    ],
    baseURL: [
        async ({ rhdhDeploymentWorker }, use) => {
            await use(rhdhDeploymentWorker.rhdhUrl);
        },
        { scope: "test" },
    ],
});
export { expect } from "@playwright/test";
