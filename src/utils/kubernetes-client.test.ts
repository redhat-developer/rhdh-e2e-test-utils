import { describe, it } from "node:test";
import assert from "node:assert";
import {
  isTransientImagePullFailure,
  isUnrecoverableWaitingState,
} from "./kubernetes-client.js";

const IMAGE = "quay.io/rhdh/rhdh-hub-rhel10@sha256:abc";

const THROTTLED_PULLS = [
  {
    name: "kubelet pull QPS limit",
    waiting: { reason: "ErrImagePull", message: "pull QPS exceeded" },
  },
  {
    name: "back-off carrying the QPS error (Kubernetes 1.32+)",
    waiting: {
      reason: "ImagePullBackOff",
      message: `Back-off pulling image "${IMAGE}": ErrImagePull: pull QPS exceeded`,
    },
  },
  {
    name: "CRI-O registry rate limit",
    waiting: {
      reason: "ErrImagePull",
      message: `initializing source docker://${IMAGE}: reading manifest sha256:abc in quay.io/rhdh/rhdh-hub-rhel10: too many requests to registry`,
    },
  },
  {
    name: "containerd registry rate limit",
    waiting: {
      reason: "ErrImagePull",
      message: `failed to pull and unpack image "${IMAGE}": unexpected status from HEAD request: 429 Too Many Requests`,
    },
  },
  {
    name: "registry toomanyrequests error code",
    waiting: {
      reason: "ErrImagePull",
      message: "toomanyrequests: Rate exceeded",
    },
  },
];

const BROKEN_PULLS = [
  {
    name: "missing image",
    waiting: {
      reason: "ImagePullBackOff",
      message: `Back-off pulling image "${IMAGE}": ErrImagePull: reading manifest: manifest unknown`,
    },
  },
  {
    name: "authentication error",
    waiting: {
      reason: "ErrImagePull",
      message:
        "unauthorized: access to the requested resource is not authorized",
    },
  },
  {
    name: "back-off without the pull error (before Kubernetes 1.32)",
    waiting: {
      reason: "ImagePullBackOff",
      message: `Back-off pulling image "${IMAGE}"`,
    },
  },
  {
    name: "no message",
    waiting: { reason: "ImagePullBackOff" },
  },
];

describe("isTransientImagePullFailure", () => {
  for (const { name, waiting } of THROTTLED_PULLS) {
    it(`is transient: ${name}`, () => {
      assert.strictEqual(isTransientImagePullFailure(waiting), true);
    });
  }

  for (const { name, waiting } of BROKEN_PULLS) {
    it(`is not transient: ${name}`, () => {
      assert.strictEqual(isTransientImagePullFailure(waiting), false);
    });
  }

  it("ignores non-pull reasons even when the message matches", () => {
    assert.strictEqual(
      isTransientImagePullFailure({
        reason: "CrashLoopBackOff",
        message: "pull QPS exceeded",
      }),
      false,
    );
  });

  it("is not transient without a waiting state", () => {
    assert.strictEqual(isTransientImagePullFailure(undefined), false);
  });
});

describe("isUnrecoverableWaitingState", () => {
  for (const { name, waiting } of THROTTLED_PULLS) {
    it(`keeps waiting on a throttled pull: ${name}`, () => {
      assert.strictEqual(isUnrecoverableWaitingState(waiting), false);
    });
  }

  for (const { name, waiting } of BROKEN_PULLS) {
    it(`fails fast on a broken pull: ${name}`, () => {
      assert.strictEqual(isUnrecoverableWaitingState(waiting), true);
    });
  }

  it("fails fast on a crash loop", () => {
    assert.strictEqual(
      isUnrecoverableWaitingState({ reason: "CrashLoopBackOff" }),
      true,
    );
  });

  it("keeps waiting while a container is still being created", () => {
    assert.strictEqual(
      isUnrecoverableWaitingState({ reason: "ContainerCreating" }),
      false,
    );
  });

  it("keeps waiting without a waiting state", () => {
    assert.strictEqual(isUnrecoverableWaitingState(undefined), false);
  });
});
