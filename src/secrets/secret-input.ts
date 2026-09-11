import { readFile as defaultReadFile } from "node:fs/promises";

export interface SecretInput {
  value: string;
  byteLength: number;
  storage: "note" | "attachment";
}

export interface SecretInputOptions {
  fromFile?: string;
  fromStdin?: boolean;
  allowEmpty?: boolean;
  readFile?: (path: string) => Promise<Buffer>;
  stdin?: Iterable<Buffer | string> | AsyncIterable<Buffer | string>;
}

export async function readSecretInput(
  options: SecretInputOptions,
): Promise<SecretInput> {
  const sourceCount =
    Number(options.fromFile !== undefined) + Number(options.fromStdin === true);
  if (sourceCount !== 1) {
    throw new Error("Exactly one of --from-file or --from-stdin is required");
  }

  const fromFile = options.fromFile !== undefined;
  const bytes = fromFile
    ? await (options.readFile ?? defaultReadFile)(options.fromFile!)
    : await readStdin(options.stdin ?? process.stdin);
  let value: string;
  try {
    value = new TextDecoder("utf-8", {
      fatal: true,
      ignoreBOM: true,
    }).decode(bytes);
  } catch {
    throw new Error("Secret input must be valid UTF-8");
  }
  if (bytes.length === 0 && options.allowEmpty !== true) {
    throw new Error("Empty secret input requires --allow-empty");
  }
  return {
    value,
    byteLength: bytes.length,
    storage: fromFile ? "attachment" : "note",
  };
}

async function readStdin(
  input: Iterable<Buffer | string> | AsyncIterable<Buffer | string>,
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of input) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, "utf8"));
  }
  return Buffer.concat(chunks);
}
