import { describe, expect, test } from "bun:test";
import { validateConfig } from "../src/config";

const valid = {
  recipientEmail: "you@example.com",
  storyCount: 25,
  schedule: { cron: "0 7 * * *", timezone: "America/Toronto" },
};

describe("validateConfig", () => {
  test("accepts a valid config", () => {
    const config = validateConfig(valid, "test.json");
    expect(config).toEqual(valid);
  });

  test("rejects a non-object", () => {
    expect(() => validateConfig(null, "test.json")).toThrow(/must be a JSON object/);
    expect(() => validateConfig("nope", "test.json")).toThrow(/must be a JSON object/);
  });

  test("rejects a missing/invalid recipientEmail", () => {
    expect(() => validateConfig({ ...valid, recipientEmail: undefined }, "test.json")).toThrow(
      /recipientEmail/,
    );
    expect(() => validateConfig({ ...valid, recipientEmail: "not-an-email" }, "test.json")).toThrow(
      /recipientEmail/,
    );
  });

  test("rejects a non-positive or non-integer storyCount", () => {
    expect(() => validateConfig({ ...valid, storyCount: 0 }, "test.json")).toThrow(/storyCount/);
    expect(() => validateConfig({ ...valid, storyCount: -5 }, "test.json")).toThrow(/storyCount/);
    expect(() => validateConfig({ ...valid, storyCount: 1.5 }, "test.json")).toThrow(/storyCount/);
    expect(() => validateConfig({ ...valid, storyCount: "25" }, "test.json")).toThrow(/storyCount/);
  });

  test("rejects a missing schedule object", () => {
    expect(() => validateConfig({ ...valid, schedule: undefined }, "test.json")).toThrow(
      /schedule/,
    );
  });

  test("rejects a missing/empty cron expression", () => {
    expect(() =>
      validateConfig({ ...valid, schedule: { ...valid.schedule, cron: "" } }, "test.json"),
    ).toThrow(/schedule\.cron/);
  });

  test("rejects a missing/empty timezone", () => {
    expect(() =>
      validateConfig({ ...valid, schedule: { ...valid.schedule, timezone: "" } }, "test.json"),
    ).toThrow(/schedule\.timezone/);
  });

  test("rejects a malformed cron expression", () => {
    expect(() =>
      validateConfig(
        { ...valid, schedule: { ...valid.schedule, cron: "not a cron expression" } },
        "test.json",
      ),
    ).toThrow();
  });

  test("rejects an invalid IANA timezone", () => {
    expect(() =>
      validateConfig(
        { ...valid, schedule: { ...valid.schedule, timezone: "Not/A_Real_Zone" } },
        "test.json",
      ),
    ).toThrow();
  });
});
