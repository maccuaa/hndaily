import { afterEach, describe, expect, test } from "bun:test";

import { loadNtfyTopicFromEnv, sendNtfyNotification } from "../src/ntfy";

const originalTopic = process.env.HNDAILY_NTFY_TOPIC;

afterEach(() => {
	if (originalTopic === undefined) delete process.env.HNDAILY_NTFY_TOPIC;
	else process.env.HNDAILY_NTFY_TOPIC = originalTopic;
});

describe("loadNtfyTopicFromEnv", () => {
	test("returns null when unset", () => {
		delete process.env.HNDAILY_NTFY_TOPIC;
		expect(loadNtfyTopicFromEnv()).toBeNull();
	});

	test("returns the configured topic", () => {
		process.env.HNDAILY_NTFY_TOPIC = "my-hndaily-topic";
		expect(loadNtfyTopicFromEnv()).toBe("my-hndaily-topic");
	});
});

describe("sendNtfyNotification", () => {
	const originalFetch = globalThis.fetch;
	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	test("posts to https://ntfy.sh/<topic> with title/message/priority/tags headers", async () => {
		let requestedUrl = "";
		let requestedInit: RequestInit | undefined;
		globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
			requestedUrl = input.toString();
			requestedInit = init;
			return new Response("OK", { status: 200 });
		}) as unknown as typeof fetch;

		await sendNtfyNotification("my-topic", {
			title: "hndaily",
			message: "Sent 5 stories",
			priority: "high",
			tags: ["rotating_light", "warning"],
		});

		expect(requestedUrl).toBe("https://ntfy.sh/my-topic");
		expect(requestedInit?.method).toBe("POST");
		expect(requestedInit?.body).toBe("Sent 5 stories");
		const headers = requestedInit?.headers as Record<string, string>;
		expect(headers["X-Title"]).toBe("hndaily");
		expect(headers["X-Priority"]).toBe("high");
		expect(headers["X-Tags"]).toBe("rotating_light,warning");
	});

	test("omits X-Priority and X-Tags headers when not given", async () => {
		let requestedInit: RequestInit | undefined;
		globalThis.fetch = (async (_input: string | URL, init?: RequestInit) => {
			requestedInit = init;
			return new Response("OK", { status: 200 });
		}) as unknown as typeof fetch;

		await sendNtfyNotification("my-topic", { title: "hndaily", message: "Sent 5 stories" });

		const headers = requestedInit?.headers as Record<string, string>;
		expect(headers["X-Priority"]).toBeUndefined();
		expect(headers["X-Tags"]).toBeUndefined();
	});

	test("does not throw when the response is not ok", async () => {
		globalThis.fetch = (async () =>
			new Response("nope", { status: 500 })) as unknown as typeof fetch;

		await expect(
			sendNtfyNotification("my-topic", { title: "t", message: "m" }),
		).resolves.toBeUndefined();
	});

	test("does not throw when the network request itself fails", async () => {
		globalThis.fetch = (async () => {
			throw new Error("network down");
		}) as unknown as typeof fetch;

		await expect(
			sendNtfyNotification("my-topic", { title: "t", message: "m" }),
		).resolves.toBeUndefined();
	});
});
