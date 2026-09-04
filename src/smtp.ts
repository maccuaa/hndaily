import { connect as netConnect, type Socket } from "node:net";
import { connect as tlsConnect, type TLSSocket } from "node:tls";

import { logger } from "./logger";

/**
 * A minimal SMTP client covering exactly what hndaily needs to deliver the
 * Digest through OCI Email Delivery (ADR 0002): one recipient, an HTML-only
 * body, AUTH LOGIN, and either implicit TLS (port 465) or a STARTTLS
 * upgrade (port 587). No attachments, no multipart, no other auth
 * mechanisms — deliberately not a general-purpose mail library.
 *
 * Built on node:net / node:tls (Bun's built-in Node-compatible modules) so
 * sending mail carries zero runtime dependencies.
 */

export interface SmtpMessage {
	from: string;
	to: string;
	subject: string;
	html: string;
}

export interface SmtpConfig {
	host: string;
	port: number;
	/** true = connect straight into TLS (port 465); false = plaintext then STARTTLS (port 587). */
	secure: boolean;
	username: string;
	password: string;
}

type SmtpSocket = Socket | TLSSocket;

/** Injectable socket factories — default to real TCP/TLS, overridden in tests with fakes. */
export interface SmtpDeps {
	connectPlain: (host: string, port: number) => Promise<Socket>;
	connectTls: (host: string, port: number) => Promise<TLSSocket>;
	upgradeTls: (socket: Socket, host: string) => Promise<TLSSocket>;
}

const SOCKET_TIMEOUT_MS = 20_000;
const EHLO_IDENTITY = "localhost";

function connectPlain(host: string, port: number): Promise<Socket> {
	return new Promise((resolve, reject) => {
		const socket = netConnect({ host, port });
		socket.once("connect", () => resolve(socket));
		socket.once("error", reject);
	});
}

function connectTls(host: string, port: number): Promise<TLSSocket> {
	return new Promise((resolve, reject) => {
		const socket = tlsConnect({ host, port });
		socket.once("secureConnect", () => resolve(socket));
		socket.once("error", reject);
	});
}

/** Upgrades an existing plaintext socket to TLS in place (the STARTTLS handshake). */
function upgradeTls(socket: Socket, host: string): Promise<TLSSocket> {
	return new Promise((resolve, reject) => {
		const tlsSocket = tlsConnect({ socket, host });
		tlsSocket.once("secureConnect", () => resolve(tlsSocket));
		tlsSocket.once("error", reject);
	});
}

const defaultDeps: SmtpDeps = { connectPlain, connectTls, upgradeTls };

/**
 * Line-buffered read/write over a socket, rebindable across the STARTTLS
 * upgrade (reads and writes must move from the plaintext socket to the new
 * TLSSocket once the connection is wrapped, or bytes go out unencrypted).
 */
class SmtpLink {
	private socket: SmtpSocket;
	private buffer = "";
	private lineQueue: string[] = [];
	private lineWaiters: Array<{ resolve: (line: string) => void; reject: (err: Error) => void }> =
		[];
	private failure: Error | null = null;

	private readonly onData = (chunk: Buffer): void => this.handleData(chunk);
	private readonly onError = (err: Error): void => this.fail(err);
	private readonly onTimeout = (): void => this.fail(new Error("SMTP connection timed out"));
	private readonly onClose = (): void =>
		this.fail(new Error("SMTP connection closed unexpectedly"));

	constructor(socket: SmtpSocket) {
		this.socket = socket;
		this.attach(socket);
	}

	private attach(socket: SmtpSocket): void {
		socket.setTimeout(SOCKET_TIMEOUT_MS);
		socket.on("data", this.onData);
		socket.on("error", this.onError);
		socket.on("timeout", this.onTimeout);
		socket.on("close", this.onClose);
	}

	private detach(socket: SmtpSocket): void {
		socket.off("data", this.onData);
		socket.off("error", this.onError);
		socket.off("timeout", this.onTimeout);
		socket.off("close", this.onClose);
	}

	/** Swaps the underlying socket after a STARTTLS upgrade. */
	rebind(socket: SmtpSocket): void {
		this.detach(this.socket);
		this.socket = socket;
		this.attach(socket);
	}

	private handleData(chunk: Buffer): void {
		this.buffer += chunk.toString("utf8");
		let idx: number;
		while ((idx = this.buffer.indexOf("\r\n")) !== -1) {
			const line = this.buffer.slice(0, idx);
			this.buffer = this.buffer.slice(idx + 2);
			const waiter = this.lineWaiters.shift();
			if (waiter) waiter.resolve(line);
			else this.lineQueue.push(line);
		}
	}

	private fail(err: Error): void {
		if (this.failure) return;
		this.failure = err;
		const waiters = this.lineWaiters.splice(0);
		for (const waiter of waiters) waiter.reject(err);
	}

	private readLine(): Promise<string> {
		if (this.failure) return Promise.reject(this.failure);
		const queued = this.lineQueue.shift();
		if (queued !== undefined) return Promise.resolve(queued);
		return new Promise((resolve, reject) => this.lineWaiters.push({ resolve, reject }));
	}

	/** Reads one full SMTP response: possibly multiple "250-..." continuation lines, ending "250 ...". */
	async readResponse(): Promise<{ code: number; message: string }> {
		const lines: string[] = [];
		for (;;) {
			const line = await this.readLine();
			lines.push(line);
			if (line.charAt(3) !== "-") break;
		}
		const code = Number(lines[0]?.slice(0, 3));
		const message = lines.map((line) => line.slice(4)).join("\n");
		return { code, message };
	}

	writeCommand(line: string): void {
		this.socket.write(`${line}\r\n`);
	}

	writeRaw(data: string): void {
		this.socket.write(data);
	}

	end(): void {
		this.detach(this.socket);
		this.socket.end();
	}
}

async function expectCode(link: SmtpLink, ...codes: number[]): Promise<string> {
	const { code, message } = await link.readResponse();
	if (!codes.includes(code)) {
		throw new Error(`SMTP error ${code}: ${message}`);
	}
	return message;
}

/**
 * Rejects CRLF in any value that gets concatenated directly into an SMTP
 * command line or header (envelope addresses) rather than being encoded
 * first. Without this, an embedded "\r\n" could inject arbitrary SMTP
 * commands — the exact class of bug fixed upstream in nodemailer
 * (GHSA-c7w3-x93f-qmm8, unsanitized envelope fields allowing injected
 * RCPT TO commands).
 */
function assertNoCrlf(value: string, fieldName: string): void {
	if (/[\r\n]/.test(value)) {
		throw new Error(
			`SMTP ${fieldName} must not contain CR/LF characters: ${JSON.stringify(value)}`,
		);
	}
}

/** RFC 2047 encoded-word — only engaged when the subject actually needs it (has non-ASCII/control chars). */
function encodeSubject(subject: string): string {
	const isPlainAscii = /^[\x20-\x7e]*$/.test(subject);
	if (isPlainAscii) return subject;
	return `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
}

/** RFC 5321 dot-stuffing: a line starting with "." must be escaped as ".." so it isn't read as the DATA terminator. */
function dotStuff(body: string): string {
	const normalized = body.replace(/\r\n/g, "\n").replace(/\n/g, "\r\n");
	return normalized
		.split("\r\n")
		.map((line) => (line.startsWith(".") ? `.${line}` : line))
		.join("\r\n");
}

export async function sendMail(
	config: SmtpConfig,
	message: SmtpMessage,
	deps: SmtpDeps = defaultDeps,
): Promise<void> {
	// Validate untrusted-shaped fields before opening a connection at all.
	assertNoCrlf(message.from, "from address");
	assertNoCrlf(message.to, "to address");
	assertNoCrlf(message.subject, "subject");

	const socket = config.secure
		? await deps.connectTls(config.host, config.port)
		: await deps.connectPlain(config.host, config.port);
	const link = new SmtpLink(socket);

	try {
		await expectCode(link, 220);

		link.writeCommand(`EHLO ${EHLO_IDENTITY}`);
		const capabilities = await expectCode(link, 250);
		// Logged so a local test run (--dry-run/--run-once) can show exactly
		// which AUTH mechanisms the server advertises — the fact needed to
		// diagnose an "SMTP error 504: ... authentication mechanism ..." failure.
		logger.info("SMTP EHLO capabilities", { host: config.host, phase: "initial", capabilities });

		if (!config.secure) {
			link.writeCommand("STARTTLS");
			await expectCode(link, 220);
			const tlsSocket = await deps.upgradeTls(socket as Socket, config.host);
			link.rebind(tlsSocket);

			link.writeCommand(`EHLO ${EHLO_IDENTITY}`);
			const tlsCapabilities = await expectCode(link, 250);
			logger.info("SMTP EHLO capabilities", {
				host: config.host,
				phase: "post-starttls",
				capabilities: tlsCapabilities,
			});
		}

		link.writeCommand("AUTH LOGIN");
		await expectCode(link, 334);
		link.writeCommand(Buffer.from(config.username, "utf8").toString("base64"));
		await expectCode(link, 334);
		link.writeCommand(Buffer.from(config.password, "utf8").toString("base64"));
		await expectCode(link, 235);

		link.writeCommand(`MAIL FROM:<${message.from}>`);
		await expectCode(link, 250);
		link.writeCommand(`RCPT TO:<${message.to}>`);
		await expectCode(link, 250, 251);
		link.writeCommand("DATA");
		await expectCode(link, 354);

		const headers = [
			`From: ${message.from}`,
			`To: ${message.to}`,
			`Subject: ${encodeSubject(message.subject)}`,
			`Date: ${new Date().toUTCString()}`,
			"MIME-Version: 1.0",
			"Content-Type: text/html; charset=UTF-8",
		].join("\r\n");
		link.writeRaw(`${headers}\r\n\r\n${dotStuff(message.html)}\r\n.\r\n`);
		await expectCode(link, 250);

		link.writeCommand("QUIT");
		try {
			await expectCode(link, 221);
		} catch {
			// Best-effort: the message is already accepted (250 above) by this point,
			// so a QUIT-response hiccup shouldn't surface as a send failure.
		}
	} finally {
		link.end();
	}
}
