import type { Linter } from "eslint";
/**
 * Creates a base ESLint configuration for RHDH E2E tests.
 * This configuration includes TypeScript, Playwright, and file naming conventions.
 *
 * @param tsconfigRootDir - The root directory for tsconfig.json resolution
 * @returns ESLint flat config array
 */
export declare function createEslintConfig(tsconfigRootDir: string): Linter.Config[];
//# sourceMappingURL=base.config.d.ts.map