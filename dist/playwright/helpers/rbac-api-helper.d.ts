import type { PermissionAction, RoleConditionalPolicyDecision } from "@backstage-community/plugin-rbac-common";
import { APIResponse } from "@playwright/test";
export interface Policy {
    entityReference: string;
    permission: string;
    policy: string;
    effect: string;
}
export interface Role {
    memberReferences: string[];
    name: string;
}
/**
 * Thin HTTP client for the RHDH RBAC permission API.
 * Uses a static factory (`build`) because the Playwright `APIRequestContext`
 * must be created asynchronously — a constructor cannot await it.
 */
export declare class RbacApiHelper {
    private readonly token;
    private readonly apiUrl;
    private readonly authHeader;
    private myContext;
    private constructor();
    /** Creates a fully-initialised instance with a live Playwright request context. */
    static build(token: string): Promise<RbacApiHelper>;
    createRoles(role: Role): Promise<APIResponse>;
    getRoles(): Promise<APIResponse>;
    updateRole(role: string, oldRole: Role, newRole: Role): Promise<APIResponse>;
    deleteRole(role: string): Promise<APIResponse>;
    getPoliciesByRole(policy: string): Promise<APIResponse>;
    createPolicies(policy: Policy[]): Promise<APIResponse>;
    deletePolicy(policy: string, policies: Policy[]): Promise<APIResponse>;
    /** Fetches all conditional policies across all roles. */
    getConditions(): Promise<APIResponse>;
    /** Filters a full conditions list down to those belonging to a specific role entity ref. */
    getConditionsByRole(role: string, remainingConditions: RoleConditionalPolicyDecision<PermissionAction>[]): Promise<RoleConditionalPolicyDecision<PermissionAction>[]>;
    /** `id` comes from the `RoleConditionalPolicyDecision.id` field returned by the API. */
    deleteCondition(id: string): Promise<APIResponse>;
}
export declare class Response {
    static removeMetadataFromResponse(response: APIResponse): Promise<unknown[]>;
}
//# sourceMappingURL=rbac-api-helper.d.ts.map