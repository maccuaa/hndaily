import {
	afterEach,
	beforeEach,
	describe,
	expect,
	mock,
	setSystemTime,
	spyOn,
	test,
} from "bun:test";

import type { LogLevel } from "../src/logger";
import { formatLog, logger } from "../src/logger";

const PREFIX = "2026-11-06 07:00:03";

beforeEach(() => {
	// No zone suffix, so this is local time and the expected text holds in any TZ
	setSystemTime(new Date("2026-11-06T07:00:03"));
});

afterEach(() => {
	setSystemTime();
	mock.restore();
});

// Color is passed explicitly so results don't depend on whether the test runner's stdout is a TTY
const plain = (level: LogLevel, msg: string, ctx?: Record<string, unknown>): string =>
	formatLog(level, msg, ctx, false);

// Color auto-enables on a TTY, so strip it to keep the logger tests independent of where they run
const written = (spy: { mock: { calls: unknown[][] } }): string[] =>
	spy.mock.calls.map(([chunk]) => Bun.stripANSI(String(chunk)));

describe("formatLog", () => {
	test("renders the timestamp, a padded level and the message", () => {
		expect(plain("INFO", "hndaily starting")).toBe(`${PREFIX} INFO  hndaily starting`);
		expect(plain("WARN", "Heartbeat ping failed")).toBe(`${PREFIX} WARN  Heartbeat ping failed`);
		expect(plain("ERROR", "Delivery run failed")).toBe(`${PREFIX} ERROR Delivery run failed`);
	});

	test("renders context as key=value pairs in insertion order, skipping undefined", () => {
		const ctx = { storiesSentCount: 25, isCatchup: false, dryRun: undefined, proxy: null };

		expect(plain("INFO", "Delivery run succeeded", ctx)).toBe(
			`${PREFIX} INFO  Delivery run succeeded storiesSentCount=25 isCatchup=false proxy=null`,
		);
	});

	test("treats an empty context like no context", () => {
		expect(plain("INFO", "evt", {})).toBe(plain("INFO", "evt"));
	});

	describe("values", () => {
		const cases: [name: string, value: unknown, rendered: string][] = [
			["a plain string", "night-wire", "night-wire"],
			["a URL containing = and ?", "https://hc-ping.com/abc?x=1", "https://hc-ping.com/abc?x=1"],
			["a number", 25, "25"],
			["a string with spaces", "0 7 * * *", '"0 7 * * *"'],
			["a string with a quote", 'say "hi"', '"say \\"hi\\""'],
			["an empty string", "", '""'],
			["a string with a newline", "AUTH PLAIN\nPIPELINING", '"AUTH PLAIN\\nPIPELINING"'],
			["a string with an escape character", "\u001b[31mred", '"\\u001b[31mred"'],
			["an Error", new TypeError("boom"), '"TypeError: boom"'],
			["an object", { a: 1, b: [2] }, '{"a":1,"b":[2]}'],
		];

		for (const [name, value, rendered] of cases) {
			test(`renders ${name}`, () => {
				expect(plain("INFO", "evt", { k: value })).toBe(`${PREFIX} INFO  evt k=${rendered}`);
			});
		}

		test("does not throw on values JSON cannot serialize", () => {
			const circular: Record<string, unknown> = {};
			circular.self = circular;

			expect(plain("INFO", "evt", { k: circular })).toBe(`${PREFIX} INFO  evt k=[unserializable]`);
		});

		test("keeps server-supplied text from spanning or forging log lines", () => {
			const error = `SMTP error 504: no mechanism\n${PREFIX} INFO  forged`;

			const line = plain("ERROR", "Delivery run failed", { error });

			expect(line.split("\n")).toHaveLength(1);
			expect(line).toContain(`error="SMTP error 504: no mechanism\\n${PREFIX} INFO  forged"`);
		});
	});

	describe("color", () => {
		test("dims the timestamp and colors only WARN and ERROR", () => {
			const dimTime = `\u001b[2m${PREFIX}\u001b[0m`;

			expect(formatLog("INFO", "evt", undefined, true)).toBe(`${dimTime} INFO  evt`);
			expect(formatLog("WARN", "evt", undefined, true)).toBe(
				`${dimTime} \u001b[33mWARN \u001b[0m evt`,
			);
			expect(formatLog("ERROR", "evt", undefined, true)).toBe(
				`${dimTime} \u001b[31mERROR\u001b[0m evt`,
			);
		});

		test("emits no escape sequences when color is off", () => {
			expect(formatLog("ERROR", "evt", { a: 1 }, false)).not.toContain("\u001b");
		});

		test("defaults to Bun's ANSI color detection", () => {
			expect(formatLog("WARN", "evt")).toBe(
				formatLog("WARN", "evt", undefined, Bun.enableANSIColors),
			);
		});
	});
});

describe("logger", () => {
	test("writes info to stdout and warn and error to stderr, one line each", () => {
		const stdout = spyOn(process.stdout, "write").mockImplementation(() => true);
		const stderr = spyOn(process.stderr, "write").mockImplementation(() => true);

		logger.info("a.info", { n: 1 });
		logger.warn("a.warn");
		logger.error("a.error", { error: "boom" });

		expect(written(stdout)).toEqual([`${PREFIX} INFO  a.info n=1\n`]);
		expect(written(stderr)).toEqual([
			`${PREFIX} WARN  a.warn\n`,
			`${PREFIX} ERROR a.error error=boom\n`,
		]);
	});

	test("formats the same whatever NODE_ENV is", () => {
		const stdout = spyOn(process.stdout, "write").mockImplementation(() => true);
		const originalNodeEnv = process.env.NODE_ENV;

		try {
			for (const env of ["production", "development"]) {
				process.env.NODE_ENV = env;
				logger.info("evt", { n: 1 });
			}
		} finally {
			if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
			else process.env.NODE_ENV = originalNodeEnv;
		}

		expect(written(stdout)).toEqual([`${PREFIX} INFO  evt n=1\n`, `${PREFIX} INFO  evt n=1\n`]);
	});
});
