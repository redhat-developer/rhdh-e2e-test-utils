import { $ } from "zx";
$.quiet = true;
$.stdio = ["inherit", "inherit", "inherit"];
/**
 * Runs a shell command with stdout/stderr captured. On success, output is not printed.
 * On non-zero exit, stdout and stderr are written to console.error and an error is thrown.
 * Use for noisy commands that should stay quiet on success but show output when they fail.
 */
export async function runQuietUnlessFailure(strings, ...values) {
    const runWithPipe = $({
        stdio: ["pipe", "pipe", "pipe"],
        nothrow: true,
    });
    const result = (await runWithPipe(strings, ...values));
    if (result.exitCode !== 0) {
        if (result.stdout?.trim()) {
            console.error("[command stdout]:", result.stdout.trim());
        }
        if (result.stderr?.trim()) {
            console.error("[command stderr]:", result.stderr.trim());
        }
        throw new Error(`Command failed with exit code ${result.exitCode}. Output above.`);
    }
}
export { $ };
