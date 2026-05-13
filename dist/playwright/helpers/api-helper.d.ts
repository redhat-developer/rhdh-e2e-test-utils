import type { APIResponse } from "@playwright/test";
export declare class APIHelper {
    private static githubAPIVersion;
    private staticToken;
    private baseUrl;
    useStaticToken: boolean;
    static githubRequest(method: string, url: string, body?: string | object): Promise<APIResponse>;
    static getGithubPaginatedRequest(url: string, pageNo?: number, response?: unknown[]): Promise<unknown[]>;
    static createGitHubRepo(owner: string, repoName: string): Promise<void>;
    static createGitHubRepoWithFile(owner: string, repoName: string, filename: string, fileContent: string): Promise<void>;
    static createFileInRepo(owner: string, repoName: string, filePath: string, content: string, commitMessage: string, branch?: string): Promise<void>;
    static initCommit(owner: string, repo: string, branch?: string): Promise<void>;
    static deleteGitHubRepo(owner: string, repoName: string): Promise<void>;
    static mergeGitHubPR(owner: string, repoName: string, pullNumber: number): Promise<void>;
    static getGitHubPRs(owner: string, repoName: string, state: "open" | "closed" | "all", paginated?: boolean): Promise<any>;
    static getfileContentFromPR(owner: string, repoName: string, pr: number, filename: string): Promise<string>;
    getGuestToken(): Promise<string>;
    getGuestAuthHeader(): Promise<{
        [key: string]: string;
    }>;
    setStaticToken(token: string): Promise<void>;
    setBaseUrl(url: string): Promise<void>;
    static apiRequestWithStaticToken(method: string, url: string, staticToken: string, body?: string | object): Promise<APIResponse>;
    getAllCatalogUsersFromAPI(): Promise<any>;
    getAllCatalogLocationsFromAPI(): Promise<any>;
    getAllCatalogGroupsFromAPI(): Promise<any>;
    getGroupEntityFromAPI(group: string): Promise<any>;
    getCatalogUserFromAPI(user: string): Promise<any>;
    deleteUserEntityFromAPI(user: string): Promise<(() => string) | undefined>;
    getCatalogGroupFromAPI(group: string): Promise<any>;
    deleteGroupEntityFromAPI(group: string): Promise<() => string>;
    scheduleEntityRefreshFromAPI(entity: string, kind: string, token: string): Promise<number>;
    /**
     * Fetches the UID of an entity by its name from the Backstage catalog.
     *
     * @param name - The name of the entity (e.g., 'hello-world-2').
     * @returns The UID string if found, otherwise undefined.
     */
    static getEntityUidByName(name: string): Promise<string | undefined>;
    /**
     * Deletes a location from the Backstage catalog by its UID.
     *
     * @param uid - The UID of the location to delete.
     * @returns The status code of the delete operation.
     */
    static deleteLocationByUid(uid: string): Promise<number>;
    /**
     * Fetches the UID of a Template entity by its name and namespace from the Backstage catalog.
     *
     * @param name - The name of the template entity (e.g., 'hello-world-2').
     * @param namespace - The namespace of the template entity (default: 'default').
     * @returns The UID string if found, otherwise undefined.
     */
    static getTemplateEntityUidByName(name: string, namespace?: string): Promise<string | undefined>;
    /**
     * Deletes an entity location from the Backstage catalog by its ID.
     *
     * @param id - The ID of the entity to delete.
     * @returns The status code of the delete operation.
     */
    static deleteEntityLocationById(id: string): Promise<number>;
    /**
     * Registers a new location in the Backstage catalog.
     *
     * @param target - The target URL of the location to register.
     * @returns The status code of the registration operation.
     */
    static registerLocation(target: string): Promise<number>;
    /**
     * Fetches the ID of a location from the Backstage catalog by its target URL.
     *
     * @param target - The target URL of the location to search for.
     * @returns The ID string if found, otherwise undefined.
     */
    static getLocationIdByTarget(target: string): Promise<string | undefined>;
}
//# sourceMappingURL=api-helper.d.ts.map