/* eslint-disable playwright/expect-expect -- node:test assertions */

import assert from "node:assert/strict";
import test from "node:test";
import { Readable } from "node:stream";
import { readSecretInput } from "../secret-input.js";

test("reads a UTF-8 file and reports its byte size", async () => {
  const result = await readSecretInput({
    fromFile: "synthetic.txt",
    readFile: async () => Buffer.from("line one\nline two\n", "utf8"),
  });

  assert.deepEqual(result, {
    value: "line one\nline two\n",
    byteLength: 18,
    storage: "attachment",
  });
});

test("reads stdin when selected and rejects a second input source", async () => {
  const result = await readSecretInput({
    fromStdin: true,
    stdin: Readable.from([Buffer.from("synthetic")]),
  });
  assert.equal(result.value, "synthetic");
  assert.equal(result.byteLength, 9);
  assert.equal(result.storage, "note");

  await assert.rejects(
    () =>
      readSecretInput({
        fromFile: "secret.txt",
        fromStdin: true,
        readFile: async () => Buffer.from("ignored"),
      }),
    /exactly one/i,
  );
});

test("rejects missing input and invalid UTF-8", async () => {
  await assert.rejects(
    () => readSecretInput({ readFile: async () => Buffer.from("") }),
    /exactly one/i,
  );
  await assert.rejects(
    () =>
      readSecretInput({
        fromFile: "secret.txt",
        readFile: async () => Buffer.from([0xc3, 0x28]),
      }),
    /UTF-8/i,
  );
});

test("requires explicit confirmation for an empty value", async () => {
  await assert.rejects(
    () =>
      readSecretInput({
        fromFile: "empty.txt",
        readFile: async () => Buffer.alloc(0),
      }),
    /allow-empty/i,
  );

  const result = await readSecretInput({
    fromFile: "empty.txt",
    allowEmpty: true,
    readFile: async () => Buffer.alloc(0),
  });
  assert.deepEqual(result, { value: "", byteLength: 0, storage: "attachment" });
});

test("preserves a UTF-8 BOM during validation", async () => {
  const result = await readSecretInput({
    fromFile: "bom.txt",
    readFile: async () => Buffer.from([0xef, 0xbb, 0xbf, 0x76]),
  });
  assert.equal(result.value, "\ufeffv");
  assert.equal(Buffer.byteLength(result.value, "utf8"), 4);
});
