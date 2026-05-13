import { request, expect } from "@playwright/test";
import { GITHUB_API_ENDPOINTS } from "./api-endpoints.js";
export class APIHelper {
    static githubAPIVersion = "2022-11-28";
    staticToken = "";
    baseUrl = "";
    useStaticToken = false;
    static async githubRequest(method, url, body) {
        const context = await request.newContext();
        const options = {
            method: method,
            headers: {
                Accept: "application/vnd.github+json",
                Authorization: `Bearer ${process.env.VAULT_GITHUB_USER_TOKEN}`,
                "X-GitHub-Api-Version": this.githubAPIVersion,
            },
        };
        if (body) {
            options.data = body;
        }
        const response = await context.fetch(url, options);
        return response;
    }
    static async getGithubPaginatedRequest(url, pageNo = 1, response = []) {
        const fullUrl = `${url}&page=${pageNo}`;
        const result = await this.githubRequest("GET", fullUrl);
        const body = await result.json();
        if (!Array.isArray(body)) {
            throw new Error(`Expected array but got ${typeof body}: ${JSON.stringify(body)}`);
        }
        if (body.length === 0) {
            return response;
        }
        response = [...response, ...body];
        return await this.getGithubPaginatedRequest(url, pageNo + 1, response);
    }
    static async createGitHubRepo(owner, repoName) {
        const response = await APIHelper.githubRequest("POST", GITHUB_API_ENDPOINTS.createRepo(owner), {
            name: repoName,
            private: false,
        });
        expect(response.status() === 201 || response.ok()).toBeTruthy();
    }
    static async createGitHubRepoWithFile(owner, repoName, filename, fileContent) {
        // Create the repository
        await APIHelper.createGitHubRepo(owner, repoName);
        // Wait until repository is created
        await expect
            .poll(async () => {
            const res = await APIHelper.githubRequest("GET", GITHUB_API_ENDPOINTS.getRepo(owner, repoName));
            return res.status();
        }, {
            timeout: 30_000,
            intervals: [5000],
        })
            .toBe(200);
        // Add the specified file
        await APIHelper.createFileInRepo(owner, repoName, filename, fileContent, `Add ${filename} file`);
    }
    static async createFileInRepo(owner, repoName, filePath, content, commitMessage, branch = "main") {
        const encodedContent = Buffer.from(content).toString("base64");
        const response = await APIHelper.githubRequest("PUT", `${GITHUB_API_ENDPOINTS.contents(owner, repoName)}/${filePath}`, {
            message: commitMessage,
            content: encodedContent,
            branch: branch,
        });
        expect(response.status() === 201 || response.ok()).toBeTruthy();
    }
    static async initCommit(owner, repo, branch = "main") {
        const content = Buffer.from("This is the initial commit for the repository.").toString("base64");
        const response = await APIHelper.githubRequest("PUT", `${GITHUB_API_ENDPOINTS.contents(owner, repo)}/initial-commit.md`, {
            message: "Initial commit",
            content: content,
            branch: branch,
        });
        expect(response.status() === 201 || response.ok()).toBeTruthy();
    }
    static async deleteGitHubRepo(owner, repoName) {
        await APIHelper.githubRequest("DELETE", GITHUB_API_ENDPOINTS.deleteRepo(owner, repoName));
    }
    static async mergeGitHubPR(owner, repoName, pullNumber) {
        await APIHelper.githubRequest("PUT", GITHUB_API_ENDPOINTS.mergePR(owner, repoName, pullNumber));
    }
    static async getGitHubPRs(owner, repoName, state, paginated = false) {
        const url = GITHUB_API_ENDPOINTS.pull(owner, repoName, state);
        if (paginated) {
            return await APIHelper.getGithubPaginatedRequest(url);
        }
        const response = await APIHelper.githubRequest("GET", url);
        return response.json();
    }
    static async getfileContentFromPR(owner, repoName, pr, filename) {
        const response = await APIHelper.githubRequest("GET", GITHUB_API_ENDPOINTS.pullFiles(owner, repoName, pr));
        const fileRawUrl = (await response.json()).find((file) => file.filename === filename).raw_url;
        const rawFileContent = await (await APIHelper.githubRequest("GET", fileRawUrl)).text();
        return rawFileContent;
    }
    async getGuestToken() {
        const context = await request.newContext();
        const response = await context.post("/api/auth/guest/refresh");
        expect(response.status()).toBe(200);
        const data = await response.json();
        return data.backstageIdentity.token;
    }
    async getGuestAuthHeader() {
        const token = await this.getGuestToken();
        const headers = {
            Authorization: `Bearer ${token}`,
        };
        return headers;
    }
    async setStaticToken(token) {
        this.useStaticToken = true;
        this.staticToken = "Bearer " + token;
    }
    async setBaseUrl(url) {
        this.baseUrl = url;
    }
    static async apiRequestWithStaticToken(method, url, staticToken, body) {
        const context = await request.newContext();
        const options = {
            method: method,
            headers: {
                Accept: "application/json",
                Authorization: `${staticToken}`,
            },
            ...(body && { data: body }),
        };
        const response = await context.fetch(url, options);
        return response;
    }
    async getAllCatalogUsersFromAPI() {
        const url = `${this.baseUrl}/api/catalog/entities/by-query?orderField=metadata.name%2Casc&filter=kind%3Duser`;
        const token = this.useStaticToken ? this.staticToken : "";
        const response = await APIHelper.apiRequestWithStaticToken("GET", url, token);
        return response.json();
    }
    async getAllCatalogLocationsFromAPI() {
        const url = `${this.baseUrl}/api/catalog/entities/by-query?orderField=metadata.name%2Casc&filter=kind%3Dlocation`;
        const token = this.useStaticToken ? this.staticToken : "";
        const response = await APIHelper.apiRequestWithStaticToken("GET", url, token);
        return response.json();
    }
    async getAllCatalogGroupsFromAPI() {
        const url = `${this.baseUrl}/api/catalog/entities/by-query?orderField=metadata.name%2Casc&filter=kind%3Dgroup`;
        const token = this.useStaticToken ? this.staticToken : "";
        const response = await APIHelper.apiRequestWithStaticToken("GET", url, token);
        return response.json();
    }
    async getGroupEntityFromAPI(group) {
        const url = `${this.baseUrl}/api/catalog/entities/by-name/group/default/${group}`;
        const token = this.useStaticToken ? this.staticToken : "";
        const response = await APIHelper.apiRequestWithStaticToken("GET", url, token);
        return response.json();
    }
    async getCatalogUserFromAPI(user) {
        const url = `${this.baseUrl}/api/catalog/entities/by-name/user/default/${user}`;
        const token = this.useStaticToken ? this.staticToken : "";
        const response = await APIHelper.apiRequestWithStaticToken("GET", url, token);
        return response.json();
    }
    async deleteUserEntityFromAPI(user) {
        const r = await this.getCatalogUserFromAPI(user);
        if (!r.metadata?.uid) {
            return;
        }
        const url = `${this.baseUrl}/api/catalog/entities/by-uid/${r.metadata.uid}`;
        const token = this.useStaticToken ? this.staticToken : "";
        const response = await APIHelper.apiRequestWithStaticToken("DELETE", url, token);
        return response.statusText;
    }
    async getCatalogGroupFromAPI(group) {
        const url = `${this.baseUrl}/api/catalog/entities/by-name/group/default/${group}`;
        const token = this.useStaticToken ? this.staticToken : "";
        const response = await APIHelper.apiRequestWithStaticToken("GET", url, token);
        return response.json();
    }
    async deleteGroupEntityFromAPI(group) {
        const r = await this.getCatalogGroupFromAPI(group);
        const url = `${this.baseUrl}/api/catalog/entities/by-uid/${r.metadata.uid}`;
        const token = this.useStaticToken ? this.staticToken : "";
        const response = await APIHelper.apiRequestWithStaticToken("DELETE", url, token);
        return response.statusText;
    }
    async scheduleEntityRefreshFromAPI(entity, kind, token) {
        const url = `${this.baseUrl}/api/catalog/refresh`;
        const reqBody = { entityRef: `${kind}:default/${entity}` };
        const responseRefresh = await APIHelper.apiRequestWithStaticToken("POST", url, token, reqBody);
        return responseRefresh.status();
    }
    /**
     * Fetches the UID of an entity by its name from the Backstage catalog.
     *
     * @param name - The name of the entity (e.g., 'hello-world-2').
     * @returns The UID string if found, otherwise undefined.
     */
    static async getEntityUidByName(name) {
        const baseUrl = process.env.RHDH_BASE_URL;
        const url = `${baseUrl}/api/catalog/entities/by-name/template/default/${name}`;
        const context = await request.newContext();
        const response = await context.get(url);
        if (response.status() !== 200) {
            return undefined;
        }
        const data = await response.json();
        return data?.metadata?.uid;
    }
    /**
     * Deletes a location from the Backstage catalog by its UID.
     *
     * @param uid - The UID of the location to delete.
     * @returns The status code of the delete operation.
     */
    static async deleteLocationByUid(uid) {
        const baseUrl = process.env.RHDH_BASE_URL;
        const url = `${baseUrl}/api/catalog/locations/${uid}`;
        const context = await request.newContext();
        const response = await context.delete(url);
        return response.status();
    }
    /**
     * Fetches the UID of a Template entity by its name and namespace from the Backstage catalog.
     *
     * @param name - The name of the template entity (e.g., 'hello-world-2').
     * @param namespace - The namespace of the template entity (default: 'default').
     * @returns The UID string if found, otherwise undefined.
     */
    static async getTemplateEntityUidByName(name, namespace = "default") {
        const baseUrl = process.env.RHDH_BASE_URL;
        const url = `${baseUrl}/api/catalog/locations/by-entity/template/${namespace}/${name}`;
        const context = await request.newContext();
        const response = await context.get(url);
        if (response.status() === 200) {
            const data = await response.json();
            return data?.metadata?.uid;
        }
        if (response.status() === 404) {
            return undefined;
        }
        return undefined;
    }
    /**
     * Deletes an entity location from the Backstage catalog by its ID.
     *
     * @param id - The ID of the entity to delete.
     * @returns The status code of the delete operation.
     */
    static async deleteEntityLocationById(id) {
        const baseUrl = process.env.RHDH_BASE_URL;
        const url = `${baseUrl}/api/catalog/locations/${id}`;
        const context = await request.newContext();
        const response = await context.delete(url);
        return response.status();
    }
    /**
     * Registers a new location in the Backstage catalog.
     *
     * @param target - The target URL of the location to register.
     * @returns The status code of the registration operation.
     */
    static async registerLocation(target) {
        const baseUrl = process.env.RHDH_BASE_URL;
        const url = `${baseUrl}/api/catalog/locations`;
        const context = await request.newContext();
        const response = await context.post(url, {
            data: {
                type: "url",
                target,
            },
            headers: {
                "Content-Type": "application/json",
            },
        });
        return response.status();
    }
    /**
     * Fetches the ID of a location from the Backstage catalog by its target URL.
     *
     * @param target - The target URL of the location to search for.
     * @returns The ID string if found, otherwise undefined.
     */
    static async getLocationIdByTarget(target) {
        const baseUrl = process.env.RHDH_BASE_URL;
        const url = `${baseUrl}/api/catalog/locations`;
        const context = await request.newContext();
        const response = await context.get(url);
        if (response.status() !== 200) {
            return undefined;
        }
        const data = await response.json();
        // data is expected to be an array of objects with a 'data' property
        const location = (Array.isArray(data) ? data : []).find((entry) => entry?.data?.target === target);
        return location?.data?.id;
    }
}
