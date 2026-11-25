import { describe, it } from "node:test";
import assert from "node:assert";
import { isTransientImagePullFailure } from "./kubernetes-client.js";

const IMAGE = "quay.io/rhdh/rhdh-hub-rhel10@sha256:abc";

describe("isTransientImagePullFailure", () => {
  it("treats a kubelet pull QPS limit as transient", () => {
    assert.strictEqual(
      isTransientImagePullFailure({
        reason: "ErrImagePull",
        message: "pull QPS exceeded",
      }),
      true,
    );
  });

  it("reads the previous pull error carried by ImagePullBackOff", () => {
    assert.strictEqual(
      isTransientImagePullFailure({
        reason: "ImagePullBackOff",
        message: `Back-off pulling image "${IMAGE}": ErrImagePull: pull QPS exceeded`,
      }),
      true,
    );
  });

  it("treats a registry rate limit as transient", () => {
    assert.strictEqual(
      isTransientImagePullFailure({
        reason: "ErrImagePull",
        message: `failed to pull and unpack image "${IMAGE}": unexpected status from HEAD request: 429 Too Many Requests`,
      }),
      true,
    );
    assert.strictEqual(
      isTransientImagePullFailure({
        reason: "ErrImagePull",
        message: "toomanyrequests: Rate exceeded",
      }),
      true,
    );
  });

  it("keeps failing fast on a missing image", () => {
    assert.strictEqual(
      isTransientImagePullFailure({
        reason: "ImagePullBackOff",
        message: `Back-off pulling image "${IMAGE}": ErrImagePull: reading manifest: manifest unknown`,
      }),
      false,
    );
  });

  it("keeps failing fast on an authentication error", () => {
    assert.strictEqual(
      isTransientImagePullFailure({
        reason: "ErrImagePull",
        message:
          "unauthorized: access to the requested resource is not authorized",
      }),
      false,
    );
  });

  it("keeps failing fast when the message is missing", () => {
    assert.strictEqual(
      isTransientImagePullFailure({ reason: "ImagePullBackOff" }),
      false,
    );
  });

  it("ignores non-pull reasons even when the message matches", () => {
    assert.strictEqual(
      isTransientImagePullFailure({
        reason: "CrashLoopBackOff",
        message: "pull QPS exceeded",
      }),
      false,
    );
    assert.strictEqual(isTransientImagePullFailure(undefined), false);
  });
});
