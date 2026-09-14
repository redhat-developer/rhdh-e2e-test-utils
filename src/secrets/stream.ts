import { isValidEnvironmentName } from "./environment-name.js";

export interface SecretStreamEntry {
  name: string;
  value: string;
}

export const SECRET_STREAM_ENVIRONMENT_VARIABLE = "RHDH_E2E_SECRET_FD";
export const SECRET_STREAM_FD = 3;

const HEADER = new TextEncoder().encode("RHDHSEC1");
const FOOTER = new TextEncoder().encode("RHDHEND1");
const HEADER_BYTES = HEADER.byteLength + 4;
const FOOTER_BYTES = FOOTER.byteLength;
const ENTRY_FRAME_BYTES = 8;
const MAX_ENTRIES = 65535;
const MAX_FIELD_BYTES = 8 * 1024 * 1024;
const MAX_STREAM_BYTES = 64 * 1024 * 1024;
const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });

/*
 * header: ASCII "RHDHSEC1" (8 bytes) + entry count (4 bytes)
 * entry:  name length (4 bytes) + value length (4 bytes)
 *         + UTF-8 name bytes + UTF-8 value bytes
 * footer: ASCII "RHDHEND1" (8 bytes)
 *
 * All integers are unsigned big-endian 32-bit values.
 */

interface EncodedEntry {
  name: string;
  value: string;
  nameBytes: number;
  valueBytes: number;
}

export async function writeSecretStream(
  stream: NodeJS.WritableStream,
  entries: readonly SecretStreamEntry[],
): Promise<void> {
  const encodedEntries = validateEntries(entries);
  const header = new Uint8Array(HEADER_BYTES);
  header.set(HEADER);
  writeUint32(header, HEADER.byteLength, encodedEntries.length);
  await writeChunk(stream, header);

  for (const entry of encodedEntries) {
    const frame = new Uint8Array(ENTRY_FRAME_BYTES);
    writeUint32(frame, 0, entry.nameBytes);
    writeUint32(frame, 4, entry.valueBytes);
    await writeChunk(stream, frame);
    await writeChunk(stream, new TextEncoder().encode(entry.name));
    await writeChunk(stream, new TextEncoder().encode(entry.value));
  }

  await writeChunk(stream, FOOTER);
  await endStream(stream);
}

export function decodeSecretStream(input: Uint8Array): SecretStreamEntry[] {
  if (input.byteLength > MAX_STREAM_BYTES) {
    throw new Error("Secret stream exceeds the maximum size");
  }

  let offset = 0;
  if (input.byteLength < HEADER_BYTES) {
    throw new Error("Secret stream header is truncated");
  }
  if (!sameBytes(input.subarray(0, HEADER.byteLength), HEADER)) {
    throw new Error("Invalid secret stream header");
  }
  offset += HEADER.byteLength;

  const count = readUint32(input, offset);
  offset += 4;
  if (count > MAX_ENTRIES) {
    throw new Error("Secret stream contains too many entries");
  }

  const entries: SecretStreamEntry[] = [];
  const names = new Set<string>();
  for (let index = 0; index < count; index++) {
    if (input.byteLength - offset < ENTRY_FRAME_BYTES) {
      throw new Error("Secret stream entry frame is truncated");
    }
    const nameBytes = readUint32(input, offset);
    const valueBytes = readUint32(input, offset + 4);
    offset += ENTRY_FRAME_BYTES;
    validateFieldSize(nameBytes);
    validateFieldSize(valueBytes);

    const payloadBytes = nameBytes + valueBytes;
    if (input.byteLength - offset < payloadBytes) {
      throw new Error("Secret stream entry payload is truncated");
    }
    const name = decodeUtf8(input.subarray(offset, offset + nameBytes));
    offset += nameBytes;
    const value = decodeUtf8(input.subarray(offset, offset + valueBytes));
    offset += valueBytes;
    validateEntry(name, value, names);
    entries.push({ name, value });
  }

  if (input.byteLength - offset < FOOTER_BYTES) {
    throw new Error("Secret stream footer is truncated");
  }
  if (!sameBytes(input.subarray(offset, offset + FOOTER_BYTES), FOOTER)) {
    throw new Error("Invalid secret stream footer");
  }
  offset += FOOTER_BYTES;
  if (offset !== input.byteLength) {
    throw new Error("Secret stream contains trailing data");
  }
  return entries;
}

function validateEntries(
  entries: readonly SecretStreamEntry[],
): EncodedEntry[] {
  if (entries.length > MAX_ENTRIES) {
    throw new Error("Secret stream contains too many entries");
  }

  const names = new Set<string>();
  const encodedEntries: EncodedEntry[] = [];
  let totalBytes = HEADER_BYTES + FOOTER_BYTES;
  for (const entry of entries) {
    if (
      typeof entry !== "object" ||
      entry === null ||
      typeof entry.name !== "string" ||
      typeof entry.value !== "string"
    ) {
      throw new Error("Secret stream entry must contain a name and value");
    }
    validateEntry(entry.name, entry.value, names);
    const nameBytes = new TextEncoder().encode(entry.name).byteLength;
    const valueBytes = new TextEncoder().encode(entry.value).byteLength;
    validateFieldSize(nameBytes);
    validateFieldSize(valueBytes);
    totalBytes += ENTRY_FRAME_BYTES + nameBytes + valueBytes;
    if (totalBytes > MAX_STREAM_BYTES) {
      throw new Error("Secret stream exceeds the maximum size");
    }
    encodedEntries.push({ ...entry, nameBytes, valueBytes });
  }

  return encodedEntries.sort((left, right) =>
    left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
  );
}

function validateEntry(name: string, value: string, names: Set<string>): void {
  if (name.includes("\0") || value.includes("\0")) {
    throw new Error("Secret stream entries cannot contain NUL bytes");
  }
  if (!isValidEnvironmentName(name)) {
    throw new Error("Secret stream entry has an invalid environment name");
  }
  if (names.has(name)) {
    throw new Error("Secret stream contains duplicate entry names");
  }
  names.add(name);
}

function validateFieldSize(byteLength: number): void {
  if (byteLength > MAX_FIELD_BYTES) {
    throw new Error("Secret stream field exceeds the maximum size");
  }
}

function decodeUtf8(input: Uint8Array): string {
  try {
    return UTF8_DECODER.decode(input);
  } catch {
    throw new Error("Secret stream contains invalid UTF-8");
  }
}

function writeUint32(target: Uint8Array, offset: number, value: number): void {
  target[offset] = value >>> 24;
  target[offset + 1] = value >>> 16;
  target[offset + 2] = value >>> 8;
  target[offset + 3] = value;
}

function readUint32(input: Uint8Array, offset: number): number {
  return (
    input[offset]! * 0x1000000 +
    input[offset + 1]! * 0x10000 +
    input[offset + 2]! * 0x100 +
    input[offset + 3]!
  );
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  return left.every((byte, index) => byte === right[index]);
}

function writeChunk(
  stream: NodeJS.WritableStream,
  chunk: Uint8Array,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      stream.removeListener("drain", onDrain);
      stream.removeListener("error", onError);
    };
    const resolveOnce = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };
    const rejectOnce = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("Unable to write secret stream"));
    };
    const onDrain = () => resolveOnce();
    const onError = () => rejectOnce();

    stream.once("drain", onDrain);
    stream.once("error", onError);
    try {
      if (stream.write(chunk)) resolveOnce();
    } catch {
      rejectOnce();
    }
  });
}

function endStream(stream: NodeJS.WritableStream): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => stream.removeListener("error", onError);
    const resolveOnce = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };
    const rejectOnce = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("Unable to close secret stream"));
    };
    const onError = () => rejectOnce();

    stream.once("error", onError);
    try {
      stream.end(resolveOnce);
    } catch {
      rejectOnce();
    }
  });
}
