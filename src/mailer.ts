import nodemailer from "nodemailer";
import type { RenderedDigest } from "./render";

/**
 * Sends the Digest via SMTP through OCI Email Delivery (tickets 04/08).
 * Credentials and connection details come from env vars, following the
 * shared root .env / per-service `environment:` convention (ticket 07) —
 * never hardcoded, never committed.
 */
export interface MailerConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  from: string;
}

export function loadMailerConfigFromEnv(): MailerConfig {
  return {
    host: requireEnv("HNDAILY_SMTP_HOST"),
    port: Number(process.env.HNDAILY_SMTP_PORT ?? "465"),
    username: requireEnv("HNDAILY_SMTP_USERNAME"),
    password: requireEnv("HNDAILY_SMTP_PASSWORD"),
    from: process.env.HNDAILY_FROM_ADDRESS ?? "hndaily@snowcastle.ca",
  };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export async function sendDigestEmail(
  mailerConfig: MailerConfig,
  to: string,
  digest: RenderedDigest,
  createTransport: typeof nodemailer.createTransport = nodemailer.createTransport,
): Promise<void> {
  const transport = createTransport({
    host: mailerConfig.host,
    port: mailerConfig.port,
    // Port 465 is implicit TLS; anything else (e.g. 587) uses STARTTLS.
    secure: mailerConfig.port === 465,
    auth: { user: mailerConfig.username, pass: mailerConfig.password },
  });

  await transport.sendMail({
    from: mailerConfig.from,
    to,
    subject: digest.subject,
    html: digest.html,
  });
}
