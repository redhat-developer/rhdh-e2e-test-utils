import { resolve } from "path";
import { $ } from "../../utils/index.js";

const scriptPath = resolve(import.meta.dirname, "install-orchestrator.sh");

export async function installOrchestrator(namespace = "orchestrator") {
  await $`bash ${scriptPath} ${namespace}`;
}

export default installOrchestrator;
