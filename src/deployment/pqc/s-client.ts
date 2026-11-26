import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

import { type TlsGroup } from "./constants.js";

export type OpensslSClientResult = {
  raw: string;
  protocol: string | undefined;
  negotiatedGroup: string | undefined;
  peerTempKey: string | undefined;
  verifyReturnCode: string | undefined;
  hasHandshakeError: boolean;
};

/** Prefer OC_PATH, then fixed absolute paths — avoid PATH-based resolution. */
function ocBin(): string {
  const candidates = [
    process.env.OC_PATH,
    "/usr/local/bin/oc",
    "/usr/bin/oc",
  ].filter((p): p is string => Boolean(p));
  const found = candidates.find((p) => existsSync(p));
  if (!found) {
    throw new Error(
      "oc not found at /usr/bin/oc or /usr/local/bin/oc; set OC_PATH",
    );
  }
  return found;
}

/** Hub only — not postgresql, which also carries instance=redhat-developer-hub. */
function rhdhPodLabelSelector(): string {
  return process.env.INSTALLATION_METHOD === "operator"
    ? "rhdh.redhat.com/app=backstage-developer-hub"
    : "app.kubernetes.io/name=developer-hub";
}

export function getRhdhPodName(namespace: string): string {
  const labelSelector = rhdhPodLabelSelector();
  const podName = execFileSync(
    ocBin(),
    [
      "get",
      "pod",
      "-n",
      namespace,
      "-l",
      labelSelector,
      "-o",
      "jsonpath={.items[0].metadata.name}",
    ],
    { encoding: "utf-8" },
  ).trim();
  if (!podName) {
    throw new Error(
      `No RHDH pod found in ${namespace} with selector ${labelSelector}`,
    );
  }
  return podName;
}

function firstMatch(raw: string, pattern: RegExp): string | undefined {
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    const match = pattern.exec(trimmed);
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  return undefined;
}

export function parseOpensslSClientOutput(raw: string): OpensslSClientResult {
  const protocol = firstMatch(raw, /^Protocol\s*:\s*([^\r\n]+)$/iu);
  const negotiatedGroup = firstMatch(
    raw,
    /^Negotiated TLS1\.3 group:\s*([^\r\n]+)$/iu,
  );
  const peerTempKey = firstMatch(raw, /^Peer Temp Key:\s*([^,\r\n]+)/iu);
  const verifyReturnCode = firstMatch(
    raw,
    /^Verify return code:\s*([^\r\n]+)$/iu,
  );

  const hasHandshakeError =
    /ssl(v3)?\s+alert/iu.test(raw) ||
    /handshake failure/iu.test(raw) ||
    /no suitable (key share|signature algorithm|shared cipher)/iu.test(raw) ||
    /:error:[0-9A-F]+:SSL routines:/iu.test(raw);

  return {
    raw,
    protocol,
    negotiatedGroup,
    peerTempKey,
    verifyReturnCode,
    hasHandshakeError,
  };
}

/** Resolve the negotiated key-exchange name across classical and PQ output forms. */
export function resolvedKeyExchangeGroup(
  result: OpensslSClientResult,
): string | undefined {
  return result.negotiatedGroup ?? result.peerTempKey;
}

/**
 * Run openssl s_client inside the RHDH hub container against the given in-cluster
 * Service (east-west TLS terminated by the peer's OpenSSL, not by a Route).
 */
export function runOpensslSClientFromRhdhPod(options: {
  namespace: string;
  host: string;
  port: number;
  group: TlsGroup;
}): OpensslSClientResult {
  const { namespace, host, group, port } = options;

  const remoteCmd = [
    "echo | openssl s_client",
    `-connect "${host}:${port}"`,
    `-servername "${host}"`,
    `-groups ${group}`,
  ].join(" ");

  try {
    const podName = getRhdhPodName(namespace);
    const raw = execFileSync(
      ocBin(),
      ["exec", "-n", namespace, podName, "--", "sh", "-c", remoteCmd],
      {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    return parseOpensslSClientOutput(raw);
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message?: string };
    const fromOc = `${err.stdout ?? ""}\n${err.stderr ?? ""}`.trim();
    return parseOpensslSClientOutput(fromOc || (err.message ?? String(error)));
  }
}
