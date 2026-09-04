import { describe, expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import type { Socket } from "node:net";
import type { TLSSocket } from "node:tls";

import { sendMail, type SmtpConfig, type SmtpDeps } from "../src/smtp";

/**
 * A scripted stand-in for a real TCP/TLS socket: each `write()` call is
 * answered by the next canned response in `responses`, delivered
 * asynchronously via a `data` event — exactly like a real SMTP server
 * replying to the previous command. `start()` fires the first (unsolicited)
 * response: the server's greeting.
 */
class FakeSmtpSocket extends EventEmitter {
	written: string[] = [];
	ended = false;
	private index = 0;

	constructor(private responses: string[]) {
		super();
	}

	// Matches the subset of the node:net/node:tls Socket API that src/smtp.ts calls.
	setTimeout(): void {}

	write(data: string): boolean {
		this.written.push(data);
		this.emitNextResponse();
		return true;
	}

	end(): void {
		this.ended = true;
	}

	start(): void {
		this.emitNextResponse();
	}

	private emitNextResponse(): void {
		const next = this.responses[this.index];
		if (next === undefined) return;
		this.index += 1;
		// A macrotask (not queueMicrotask) so this always fires *after* the promise chain that
		// constructs SmtpLink and attaches its "data" listener has fully drained — otherwise the
		// very first response (the greeting, emitted before sendMail() does anything) can be lost.
		setTimeout(() => this.emit("data", Buffer.from(next, "utf8")), 0);
	}
}

const BASE_CONFIG = { host: "smtp.example.com", username: "user", password: "pass" };
const MESSAGE = {
	from: "hndaily@snowcastle.ca",
	to: "you@example.com",
	subject: "Digest",
	html: "<p>hi</p>",
};

/** Greeting + EHLO + AUTH LOGIN (2-step) + MAIL FROM + RCPT TO + DATA + post-DATA + QUIT = 9 responses after connect. */
const HAPPY_PATH_RESPONSES = [
	"220 smtp.example.com ready\r\n",
	"250 Hello\r\n",
	"334 VXNlcm5hbWU6\r\n",
	"334 UGFzc3dvcmQ6\r\n",
	"235 Authentication successful\r\n",
	"250 OK\r\n",
	"250 OK\r\n",
	"354 Start mail input\r\n",
	"250 OK: queued\r\n",
	"221 Bye\r\n",
];

function depsFor(socket: FakeSmtpSocket, tlsSocket: FakeSmtpSocket = socket): SmtpDeps {
	return {
		connectPlain: async () => socket as unknown as Socket,
		connectTls: async () => socket as unknown as TLSSocket,
		upgradeTls: async () => tlsSocket as unknown as TLSSocket,
	};
}

describe("sendMail — implicit TLS (port 465)", () => {
	test("sends the full AUTH LOGIN + envelope + DATA conversation over a single connection", async () => {
		const socket = new FakeSmtpSocket(HAPPY_PATH_RESPONSES);
		socket.start();

		const config: SmtpConfig = { ...BASE_CONFIG, port: 465, secure: true };
		await sendMail(config, MESSAGE, depsFor(socket));

		expect(socket.written[0]).toBe("EHLO localhost\r\n");
		expect(socket.written[1]).toBe("AUTH LOGIN\r\n");
		expect(socket.written[2]).toBe(`${Buffer.from("user").toString("base64")}\r\n`);
		expect(socket.written[3]).toBe(`${Buffer.from("pass").toString("base64")}\r\n`);
		expect(socket.written[4]).toBe("MAIL FROM:<hndaily@snowcastle.ca>\r\n");
		expect(socket.written[5]).toBe("RCPT TO:<you@example.com>\r\n");
		expect(socket.written[6]).toBe("DATA\r\n");
		expect(socket.written[7]).toContain("Subject: Digest");
		expect(socket.written[7]).toContain("\r\n\r\n<p>hi</p>\r\n.\r\n");
		expect(socket.written[8]).toBe("QUIT\r\n");
		expect(socket.ended).toBe(true);
	});

	test("never issues STARTTLS when already secure", async () => {
		const socket = new FakeSmtpSocket(HAPPY_PATH_RESPONSES);
		socket.start();

		await sendMail({ ...BASE_CONFIG, port: 465, secure: true }, MESSAGE, depsFor(socket));

		expect(socket.written).not.toContain("STARTTLS\r\n");
	});
});

describe("sendMail — STARTTLS (port 587)", () => {
	test("upgrades to TLS mid-connection and re-EHLOs before authenticating", async () => {
		const plainSocket = new FakeSmtpSocket([
			"220 smtp.example.com ready\r\n",
			// Multi-line EHLO response — exercises the "250-" continuation parser.
			"250-smtp.example.com\r\n250-STARTTLS\r\n250 8BITMIME\r\n",
			"220 Ready to start TLS\r\n",
		]);
		plainSocket.start();
		const tlsSocket = new FakeSmtpSocket(HAPPY_PATH_RESPONSES.slice(1)); // skip the greeting; already connected

		const config: SmtpConfig = { ...BASE_CONFIG, port: 587, secure: false };
		await sendMail(config, MESSAGE, depsFor(plainSocket, tlsSocket));

		expect(plainSocket.written).toEqual(["EHLO localhost\r\n", "STARTTLS\r\n"]);
		expect(tlsSocket.written[0]).toBe("EHLO localhost\r\n");
		expect(tlsSocket.written[1]).toBe("AUTH LOGIN\r\n");
		expect(tlsSocket.ended).toBe(true);
		// The pre-upgrade socket is never explicitly .end()'d — the TLS layer owns the wire from here.
		expect(plainSocket.ended).toBe(false);
	});
});

describe("sendMail — error handling", () => {
	test("throws with the SMTP code and message when authentication is rejected", async () => {
		const socket = new FakeSmtpSocket([
			"220 smtp.example.com ready\r\n",
			"250 Hello\r\n",
			"334 VXNlcm5hbWU6\r\n",
			"334 UGFzc3dvcmQ6\r\n",
			"535 Authentication credentials invalid\r\n",
		]);
		socket.start();

		await expect(
			sendMail({ ...BASE_CONFIG, port: 465, secure: true }, MESSAGE, depsFor(socket)),
		).rejects.toThrow(/535.*Authentication credentials invalid/);
	});

	test("throws when the recipient is rejected", async () => {
		const socket = new FakeSmtpSocket([
			"220 smtp.example.com ready\r\n",
			"250 Hello\r\n",
			"334 VXNlcm5hbWU6\r\n",
			"334 UGFzc3dvcmQ6\r\n",
			"235 Authentication successful\r\n",
			"250 OK\r\n",
			"550 No such user here\r\n",
		]);
		socket.start();

		await expect(
			sendMail({ ...BASE_CONFIG, port: 465, secure: true }, MESSAGE, depsFor(socket)),
		).rejects.toThrow(/550/);
		expect(socket.ended).toBe(true);
	});
});

describe("sendMail — message encoding", () => {
	test("leaves a plain-ASCII subject untouched", async () => {
		const socket = new FakeSmtpSocket(HAPPY_PATH_RESPONSES);
		socket.start();

		await sendMail(
			{ ...BASE_CONFIG, port: 465, secure: true },
			{ ...MESSAGE, subject: "HN Daily digest" },
			depsFor(socket),
		);

		expect(socket.written[7]).toContain("Subject: HN Daily digest\r\n");
	});

	test("RFC 2047-encodes a subject with non-ASCII characters", async () => {
		const socket = new FakeSmtpSocket(HAPPY_PATH_RESPONSES);
		socket.start();
		const subject = "HN Daily — Sept 3, 2026";

		await sendMail(
			{ ...BASE_CONFIG, port: 465, secure: true },
			{ ...MESSAGE, subject },
			depsFor(socket),
		);

		const expectedEncoded = `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
		expect(socket.written[7]).toContain(`Subject: ${expectedEncoded}`);
	});

	test("dot-stuffs a body line that starts with a period", async () => {
		const socket = new FakeSmtpSocket(HAPPY_PATH_RESPONSES);
		socket.start();

		await sendMail(
			{ ...BASE_CONFIG, port: 465, secure: true },
			{ ...MESSAGE, html: "<p>hi</p>\n.this line starts with a dot\n" },
			depsFor(socket),
		);

		expect(socket.written[7]).toContain("\r\n..this line starts with a dot\r\n");
	});
});
