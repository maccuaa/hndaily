import { afterEach, describe, expect, test } from "bun:test";
import { loadMailerConfigFromEnv, sendDigestEmail } from "../src/mailer";

const ENV_KEYS = [
  "HNDAILY_SMTP_HOST",
  "HNDAILY_SMTP_PORT",
  "HNDAILY_SMTP_USERNAME",
  "HNDAILY_SMTP_PASSWORD",
  "HNDAILY_FROM_ADDRESS",
] as const;

const originalEnv: Record<string, string | undefined> = {};
for (const key of ENV_KEYS) originalEnv[key] = process.env[key];

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

describe("loadMailerConfigFromEnv", () => {
  test("reads all values from env, defaulting port and from-address", () => {
    process.env.HNDAILY_SMTP_HOST = "smtp.example.com";
    delete process.env.HNDAILY_SMTP_PORT;
    process.env.HNDAILY_SMTP_USERNAME = "user";
    process.env.HNDAILY_SMTP_PASSWORD = "pass";
    delete process.env.HNDAILY_FROM_ADDRESS;

    const config = loadMailerConfigFromEnv();

    expect(config).toEqual({
      host: "smtp.example.com",
      port: 465,
      username: "user",
      password: "pass",
      from: "hndaily@snowcastle.ca",
    });
  });

  test("respects an overridden port and from-address", () => {
    process.env.HNDAILY_SMTP_HOST = "smtp.example.com";
    process.env.HNDAILY_SMTP_PORT = "587";
    process.env.HNDAILY_SMTP_USERNAME = "user";
    process.env.HNDAILY_SMTP_PASSWORD = "pass";
    process.env.HNDAILY_FROM_ADDRESS = "custom@example.com";

    const config = loadMailerConfigFromEnv();

    expect(config.port).toBe(587);
    expect(config.from).toBe("custom@example.com");
  });

  test("throws when a required env var is missing", () => {
    delete process.env.HNDAILY_SMTP_HOST;
    process.env.HNDAILY_SMTP_USERNAME = "user";
    process.env.HNDAILY_SMTP_PASSWORD = "pass";

    expect(() => loadMailerConfigFromEnv()).toThrow(/HNDAILY_SMTP_HOST/);
  });
});

describe("sendDigestEmail", () => {
  test("configures the transport with secure:true on port 465 and sends the digest", async () => {
    let transportOptions: unknown;
    let sentMessage: unknown;
    const fakeCreateTransport = ((options: unknown) => {
      transportOptions = options;
      return {
        sendMail: async (message: unknown) => {
          sentMessage = message;
        },
      };
    }) as unknown as typeof import("nodemailer").createTransport;

    await sendDigestEmail(
      { host: "smtp.example.com", port: 465, username: "u", password: "p", from: "hndaily@snowcastle.ca" },
      "you@example.com",
      { subject: "Test subject", html: "<p>hi</p>" },
      fakeCreateTransport,
    );

    expect(transportOptions).toEqual({
      host: "smtp.example.com",
      port: 465,
      secure: true,
      auth: { user: "u", pass: "p" },
    });
    expect(sentMessage).toEqual({
      from: "hndaily@snowcastle.ca",
      to: "you@example.com",
      subject: "Test subject",
      html: "<p>hi</p>",
    });
  });

  test("uses secure:false (STARTTLS) on a non-465 port", async () => {
    let transportOptions: any;
    const fakeCreateTransport = ((options: unknown) => {
      transportOptions = options;
      return { sendMail: async () => {} };
    }) as unknown as typeof import("nodemailer").createTransport;

    await sendDigestEmail(
      { host: "smtp.example.com", port: 587, username: "u", password: "p", from: "hndaily@snowcastle.ca" },
      "you@example.com",
      { subject: "s", html: "h" },
      fakeCreateTransport,
    );

    expect(transportOptions.secure).toBe(false);
  });
});
