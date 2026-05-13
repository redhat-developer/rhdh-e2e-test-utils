import { type Page } from "@playwright/test";
export declare class OrchestratorPage {
    private readonly page;
    constructor(page: Page);
    selectGreetingWorkflowItem(timeout?: number): Promise<void>;
    runGreetingWorkflow(language?: string, status?: string): Promise<void>;
    reRunGreetingWorkflow(language?: string, status?: string): Promise<void>;
    validateGreetingWorkflow(): Promise<void>;
    validateWorkflowRunsDetails(): Promise<void>;
    validateWorkflowAllRuns(): Promise<void>;
    validateWorkflowAllRunsStatusIcons(): Promise<void>;
    abortWorkflow(): Promise<void>;
    selectFailSwitchWorkflowItem(timeout?: number): Promise<void>;
    runFailSwitchWorkflow(input?: string): Promise<void>;
    validateWorkflowStatusDetails(status?: string): Promise<void>;
    validateCurrentWorkflowStatus(status?: string, timeout?: number): Promise<void>;
    reRunFailSwitchWorkflow(input?: string): Promise<void>;
    reRunOnFailure(input?: string): Promise<void>;
    verifyWorkflowsTabVisible(): Promise<void>;
    verifyWorkflowInEntityTab(workflowName: string): Promise<void>;
    clickWorkflowsTab(): Promise<void>;
}
//# sourceMappingURL=orchestrator.d.ts.map