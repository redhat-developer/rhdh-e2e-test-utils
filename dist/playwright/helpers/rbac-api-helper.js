import { request } from "@playwright/test";
/**
 * Thin HTTP client for the RHDH RBAC permission API.
 * Uses a static factory (`build`) because the Playwright `APIRequestContext`
 * must be created asynchronously — a constructor cannot await it.
 */
export class RbacApiHelper {
    token;
    apiUrl = process.env.RHDH_BASE_URL + "/api/permission/";
    authHeader;
    myContext;
    constructor(token) {
        this.token = token;
        this.authHeader = {
            Accept: "application/json",
            Authorization: `Bearer ${this.token}`,
        };
    }
    /** Creates a fully-initialised instance with a live Playwright request context. */
    static async build(token) {
        const instance = new RbacApiHelper(token);
        instance.myContext = await request.newContext({
            baseURL: instance.apiUrl,
            extraHTTPHeaders: instance.authHeader,
        });
        return instance;
    }
    // Roles:
    async createRoles(role) {
        return await this.myContext.post("roles", { data: role });
    }
    async getRoles() {
        return await this.myContext.get("roles");
    }
    async updateRole(role, oldRole, newRole) {
        return await this.myContext.put(`roles/role/default/${role}`, {
            data: { oldRole, newRole },
        });
    }
    async deleteRole(role) {
        return await this.myContext.delete(`roles/role/default/${role}`);
    }
    // Policies:
    async getPoliciesByRole(policy) {
        return await this.myContext.get(`policies/role/default/${policy}`);
    }
    async createPolicies(policy) {
        return await this.myContext.post("policies", { data: policy });
    }
    async deletePolicy(policy, policies) {
        return await this.myContext.delete(`policies/role/default/${policy}`, {
            data: policies,
        });
    }
    // Conditions:
    /** Fetches all conditional policies across all roles. */
    async getConditions() {
        return await this.myContext.get(`roles/conditions`);
    }
    /** Filters a full conditions list down to those belonging to a specific role entity ref. */
    async getConditionsByRole(role, remainingConditions) {
        return remainingConditions.filter((condition) => condition.roleEntityRef === role);
    }
    /** `id` comes from the `RoleConditionalPolicyDecision.id` field returned by the API. */
    async deleteCondition(id) {
        return await this.myContext.delete(`roles/conditions/${id}`);
    }
}
export class Response {
    static async removeMetadataFromResponse(response) {
        const responseJson = await response.json();
        if (!Array.isArray(responseJson)) {
            throw new TypeError(`Expected an array from policy response but received: ${JSON.stringify(responseJson)}`);
        }
        return responseJson.map((item) => {
            delete item.metadata;
            return item;
        });
    }
}
