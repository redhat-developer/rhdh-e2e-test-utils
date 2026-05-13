import { $ } from "zx";
/**
 * Runs a shell command with stdout/stderr captured. On success, output is not printed.
 * On non-zero exit, stdout and stderr are written to console.error and an error is thrown.
 * Use for noisy commands that should stay quiet on success but show output when they fail.
 */
export declare function runQuietUnlessFailure(strings: TemplateStringsArray, ...values: unknown[]): Promise<void>;
export { $ };
//# sourceMappingURL=bash.d.ts.map