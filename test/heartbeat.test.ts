import { afterEach, describe, expect, test } from "bun:test";
import { loadHeartbeatUrlFromEnv, sendHeartbeat } from "../src/heartbeat";

const originalFetch = globalThis.fetch;
const originalUrl = process.env.HNDAILY_HEARTBEAT_URL;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalUrl === undefined) delete process.env.HNDAILY_HEARTBEAT_URL;
  else process.env.HNDAILY_HEARTBEAT_URL = originalUrl;
});

describe("loadHeartbeatUrlFromEnv", () => {
  test("returns null when unset", () => {
    delete process.env.HNDAILY_HEARTBEAT_URL;
    expect(loadHeartbeatUrlFromEnv()).toBeNull();
  });

  test("returns the configured URL", () => {
    process.env.HNDAILY_HEARTBEAT_URL = "https://hc-ping.com/abc-123";
    expect(loadHeartbeatUrlFromEnv()).toBe("https://hc-ping.com/abc-123");
  });
});

describe("sendHeartbeat", () => {
  test("pings the given URL", async () => {
    let requestedUrl = "";
    globalThis.fetch = (async (input: string | URL) => {
      requestedUrl = input.toString();
      return new Response("OK", { status: 200 });
    }) as unknown as typeof fetch;

    await sendHeartbeat("https://hc-ping.com/abc-123");

    expect(requestedUrl).toBe("https://hc-ping.com/abc-123");
  });

  test("does not throw when the ping returns a non-ok status", async () => {
    globalThis.fetch = (async () => new Response("nope", { status: 500 })) as unknown as typeof fetch;
    await expect(sendHeartbeat("https://hc-ping.com/abc-123")).resolves.toBeUndefined();
  });

  test("does not throw when the network request itself fails", async () => {
    globalThis.fetch = (async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    await expect(sendHeartbeat("https://hc-ping.com/abc-123")).resolves.toBeUndefined();
  });
});
