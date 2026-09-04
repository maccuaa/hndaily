import type { RenderedDigest } from "./render";
import { sendMail } from "./smtp";

/**
 * Sends the Digest via SMTP through OCI Email Delivery (tickets 04/08),
 * using hndaily's own zero-dependency SMTP client (src/smtp.ts) rather
 * than a mailer library. Credentials and connection details come from env
 * vars, following the shared root .env / per-service `environment:`
 * convention (ticket 07) — never hardcoded, never committed.
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
		from: requireEnv("HNDAILY_FROM_ADDRESS"),
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
	sendMailFn: typeof sendMail = sendMail,
): Promise<void> {
	await sendMailFn(
		{
			host: mailerConfig.host,
			port: mailerConfig.port,
			// Port 465 is implicit TLS; anything else (e.g. 587) uses STARTTLS.
			secure: mailerConfig.port === 465,
			username: mailerConfig.username,
			password: mailerConfig.password,
		},
		{
			from: mailerConfig.from,
			to,
			subject: digest.subject,
			html: digest.html,
		},
	);
}
