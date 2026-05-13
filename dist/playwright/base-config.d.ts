import { PlaywrightTestConfig } from "@playwright/test";
/**
 * Base Playwright configuration that can be extended by workspace-specific configs.
 * Provides sensible defaults for RHDH plugin e2e testing.
 */
export declare const baseConfig: PlaywrightTestConfig;
/**
 * Defines a workspace-specific config by merging with base config.
 * Only allows overriding the projects configuration.
 * @param overrides - Object containing projects to override
 * @returns Merged Playwright configuration
 */
export declare function defineConfig(overrides?: Pick<PlaywrightTestConfig, "projects">): PlaywrightTestConfig;
//# sourceMappingURL=base-config.d.ts.map