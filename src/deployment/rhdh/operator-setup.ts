import { $ } from "../../utils/bash.js";

export async function installRHDHOperator(): Promise<void> {
  if (process.env.INSTALLATION_METHOD !== "operator") {
    return;
  }

  if (process.env.SKIP_OPERATOR_INSTALLATION === "true") {
    console.log("Skipping RHDH operator installation");
    return;
  }

  const version = process.env.RHDH_VERSION ?? "next";
  const isSemanticVersion = /^\d+(\.\d+)?$/.test(version);
  const branch = isSemanticVersion ? `release-${version}` : "main";

  let versionArgs: string[];
  if (isSemanticVersion) {
    versionArgs = ["-v", version];
  } else if (version === "next") {
    versionArgs = ["--next"];
  } else {
    throw new Error(
      `Invalid RHDH version "${version}". Use semantic version (e.g., "1.5") or "next".`,
    );
  }

  console.log(
    `Installing RHDH operator (branch: ${branch}, version: ${versionArgs.join(" ")})...`,
  );

  const scriptUrl = `https://raw.githubusercontent.com/redhat-developer/rhdh-operator/refs/heads/${branch}/.rhdh/scripts/install-rhdh-catalog-source.sh`;

  try {
    await $`curl -sf ${scriptUrl} | bash -s -- ${versionArgs} --install-operator rhdh`;
  } catch (error) {
    throw new Error(
      `install-rhdh-catalog-source.sh failed (branch: ${branch}, args: ${versionArgs.join(" ")} --install-operator rhdh).\nScript URL: ${scriptUrl}\n${error instanceof Error ? error.message : error}`,
      { cause: error },
    );
  }

  try {
    await $`
      timeout 300 bash -c '
        while ! oc get crd backstages.rhdh.redhat.com >/dev/null 2>&1; do
          echo "Waiting for Backstage CRD to be created..."
          sleep 10
        done
        echo "Backstage CRD is created."
      '
    `;
  } catch (error) {
    throw new Error(
      "Timed out waiting for Backstage CRD (backstages.rhdh.redhat.com) after 300s. The operator may not have installed correctly.",
      { cause: error },
    );
  }

  console.log("RHDH operator installation completed");
}
