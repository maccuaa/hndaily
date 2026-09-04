import { afterEach, describe, expect, test } from "bun:test";

import { logger } from "../src/logger";

const originalNodeEnv = process.env.NODE_ENV;
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

afterEach(() => {
	if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
	else process.env.NODE_ENV = originalNodeEnv;
	console.log = originalConsoleLog;
	console.warn = originalConsoleWarn;
	console.error = originalConsoleError;
});

describe("logger — production (JSON)", () => {
	test("info logs one JSON line via console.log with level, msg, ts, and context fields", () => {
		process.env.NODE_ENV = "production";
		let logged = "";
		console.log = (line: string) => {
			logged = line;
		};

		logger.info("Delivery run succeeded", { storiesSentCount: 5 });

		const parsed = JSON.parse(logged);
		expect(parsed.level).toBe("info");
		expect(parsed.msg).toBe("Delivery run succeeded");
		expect(parsed.storiesSentCount).toBe(5);
		expect(typeof parsed.ts).toBe("string");
		expect(Number.isNaN(Date.parse(parsed.ts))).toBe(false);
	});

	test("warn logs via console.warn", () => {
		process.env.NODE_ENV = "production";
		let logged = "";
		console.warn = (line: string) => {
			logged = line;
		};

		logger.warn("Algolia HN source failed, falling back to Firebase");

		expect(JSON.parse(logged).level).toBe("warn");
	});

	test("error logs via console.error", () => {
		process.env.NODE_ENV = "production";
		let logged = "";
		console.error = (line: string) => {
			logged = line;
		};

		logger.error("Delivery run failed", { error: "boom" });

		const parsed = JSON.parse(logged);
		expect(parsed.level).toBe("error");
		expect(parsed.error).toBe("boom");
	});

	test("omits context entirely when none is given", () => {
		process.env.NODE_ENV = "production";
		let logged = "";
		console.log = (line: string) => {
			logged = line;
		};

		logger.info("hndaily starting");

		const parsed = JSON.parse(logged);
		expect(parsed).toEqual({ level: "info", msg: "hndaily starting", ts: parsed.ts });
	});
});

describe("logger — development (human-readable)", () => {
	test("formats as [LEVEL] time msg, not JSON", () => {
		process.env.NODE_ENV = "development";
		let logged = "";
		console.log = (line: string) => {
			logged = line;
		};

		logger.info("hndaily starting");

		expect(logged.startsWith("[INFO] ")).toBe(true);
		expect(logged).toContain("hndaily starting");
		expect(() => JSON.parse(logged)).toThrow();
	});

	test("also applies when NODE_ENV is unset", () => {
		delete process.env.NODE_ENV;
		let logged = "";
		console.log = (line: string) => {
			logged = line;
		};

		logger.info("hndaily starting");

		expect(logged.startsWith("[INFO] ")).toBe(true);
	});

	test("appends pretty-printed context when present", () => {
		process.env.NODE_ENV = "development";
		let logged = "";
		console.log = (line: string) => {
			logged = line;
		};

		logger.info("Delivery run succeeded", { storiesSentCount: 5 });

		expect(logged).toContain("storiesSentCount");
	});
});
