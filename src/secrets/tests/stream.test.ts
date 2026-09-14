/* eslint-disable playwright/expect-expect -- node:test assertions */

import assert from "node:assert/strict";
import { Writable } from "node:stream";
import test from "node:test";
import {
  decodeSecretStream,
  writeSecretStream,
  type SecretStreamEntry,
} from "../stream.js";

async function encode(entries: readonly SecretStreamEntry[]): Promise<Buffer> {
  const chunks: Buffer[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(Buffer.from(chunk));
      callback();
    },
  });
  await writeSecretStream(stream, entries);
  return Buffer.concat(chunks);
}

test("round-trips sorted multiline and empty values", async () => {
  const entries: SecretStreamEntry[] = [
    { name: "ZETA_VALUE", value: "last" },
    { name: "EMPTY_VALUE", value: "" },
    { name: "ALPHA_VALUE", value: "first line\nsecond line\n" },
  ];

  const encoded = await encode(entries);

  assert.deepEqual(decodeSecretStream(encoded), [
    { name: "ALPHA_VALUE", value: "first line\nsecond line\n" },
    { name: "EMPTY_VALUE", value: "" },
    { name: "ZETA_VALUE", value: "last" },
  ]);
});

test("round-trips a value larger than an execve environment string", async () => {
  const value = "x".repeat(160 * 1024);

  const encoded = await encode([{ name: "LARGE_VALUE", value }]);

  assert.deepEqual(decodeSecretStream(encoded), [
    { name: "LARGE_VALUE", value },
  ]);
});

test("rejects truncated and trailing data", async () => {
  const encoded = await encode([{ name: "VALUE", value: "synthetic" }]);

  assert.throws(
    () => decodeSecretStream(encoded.subarray(0, encoded.length - 1)),
    /truncated|incomplete/i,
  );
  assert.throws(
    () => decodeSecretStream(Buffer.concat([encoded, Buffer.from([0])])),
    /trailing|end of input/i,
  );
});

test("rejects duplicate, invalid, NUL-containing, and oversized entries", async () => {
  await assert.rejects(
    () =>
      encode([
        { name: "DUPLICATE", value: "first" },
        { name: "DUPLICATE", value: "second" },
      ]),
    /duplicate/i,
  );
  await assert.rejects(
    () => encode([{ name: "NOT-VALID", value: "synthetic" }]),
    /environment name|invalid name/i,
  );
  await assert.rejects(
    () => encode([{ name: "NUL\0NAME", value: "synthetic" }]),
    /nul/i,
  );
  await assert.rejects(
    () => encode([{ name: "NUL_VALUE", value: "nul\0value" }]),
    /nul/i,
  );
  await assert.rejects(
    () =>
      encode([{ name: "OVERSIZED", value: "x".repeat(8 * 1024 * 1024 + 1) }]),
    /field|large|size/i,
  );
});

test("rejects an invalid header, footer, count, and field length", async () => {
  const encoded = await encode([{ name: "VALUE", value: "synthetic" }]);

  const invalidHeader = Buffer.from(encoded);
  invalidHeader[0] = invalidHeader[0]! ^ 1;
  assert.throws(() => decodeSecretStream(invalidHeader), /header/i);

  const invalidFooter = Buffer.from(encoded);
  invalidFooter[invalidFooter.length - 1] =
    invalidFooter[invalidFooter.length - 1]! ^ 1;
  assert.throws(() => decodeSecretStream(invalidFooter), /footer/i);

  const invalidCount = Buffer.from(encoded);
  invalidCount.writeUInt32BE(65536, 8);
  assert.throws(() => decodeSecretStream(invalidCount), /count|entries/i);

  const invalidFieldLength = Buffer.from(encoded);
  invalidFieldLength.writeUInt32BE(0xffffffff, 12);
  assert.throws(
    () => decodeSecretStream(invalidFieldLength),
    /field|length|truncated/i,
  );
});

test("rejects an oversized stream before writing any bytes", async () => {
  const chunks: Uint8Array[] = [];
  let ended = false;
  const stream = {
    write(chunk: Uint8Array): boolean {
      chunks.push(chunk);
      return true;
    },
    end(): void {
      ended = true;
    },
  } as unknown as NodeJS.WritableStream;
  const value = "x".repeat(8 * 1024 * 1024 - 1);
  const entries = Array.from({ length: 8 }, (_, index) => ({
    name: `VALUE_${index}`,
    value,
  }));

  await assert.rejects(
    () => writeSecretStream(stream, entries),
    /stream|size/i,
  );

  assert.deepEqual(chunks, []);
  assert.equal(ended, false);
});
