export declare const GITHUB_API_ENDPOINTS: {
    pull: (owner: string, repo: string, state: "open" | "closed" | "all") => string;
    issues: (state: string) => string;
    workflowRuns: string;
    getOrg: (owner: string) => string;
    createRepo: (owner: string) => string;
    getRepo: (owner: string, repo: string) => string;
    deleteRepo: (owner: string, repo: string) => string;
    mergePR: (owner: string, repoName: string, pullNumber: number) => string;
    pullFiles: (owner: string, repoName: string, pr: number) => string;
    contents: (owner: string, repoName: string) => string;
};
//# sourceMappingURL=api-endpoints.d.ts.map