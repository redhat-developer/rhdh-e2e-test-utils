import { Page } from "@playwright/test";
export declare class AuthApiHelper {
    private readonly page;
    constructor(page: Page);
    getToken(provider?: string, environment?: string): Promise<any>;
}
//# sourceMappingURL=auth-api-helper.d.ts.map