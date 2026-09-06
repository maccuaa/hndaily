import { describe, expect, test } from "bun:test";

import {
	formatDateLabel,
	formatGeneratedAt,
	formatNextDelivery,
	formatWindowBoundary,
} from "../src/date-utils";

const TZ = "America/Toronto";

// 2026-09-05T18:00:00Z = 5 September 2026, 14:00 in America/Toronto (EDT, UTC-4).
const SEPT_5_2PM_TORONTO = new Date("2026-09-05T18:00:00Z");
// 2026-09-06T11:00:00Z = 6 September 2026 (a Sunday), 07:00 in America/Toronto.
const SEPT_6_7AM_TORONTO = new Date("2026-09-06T11:00:00Z");
// 2026-09-06T04:00:00Z = 6 September 2026, 00:00 in America/Toronto — midnight edge case.
const MIDNIGHT_TORONTO = new Date("2026-09-06T04:00:00Z");

describe("formatDateLabel", () => {
	test("formats as day-month, with no year", () => {
		expect(formatDateLabel(SEPT_5_2PM_TORONTO, TZ)).toBe("5 September");
	});
});

describe("formatGeneratedAt", () => {
	test("formats as 'day month at H:MM'", () => {
		expect(formatGeneratedAt(SEPT_5_2PM_TORONTO, TZ)).toBe("5 September at 14:00");
	});

	test("does not zero-pad a single-digit hour", () => {
		expect(formatGeneratedAt(SEPT_6_7AM_TORONTO, TZ)).toBe("6 September at 7:00");
	});

	test("formats midnight as 0:00, not 24:00", () => {
		expect(formatGeneratedAt(MIDNIGHT_TORONTO, TZ)).toBe("6 September at 0:00");
	});
});

describe("formatWindowBoundary", () => {
	test("formats as 'day month, H:MM'", () => {
		expect(formatWindowBoundary(SEPT_5_2PM_TORONTO, TZ)).toBe("5 September, 14:00");
	});
});

describe("formatNextDelivery", () => {
	test("formats as 'Weekday, day month at H:MM'", () => {
		expect(formatNextDelivery(SEPT_6_7AM_TORONTO, TZ)).toBe("Sunday, 6 September at 7:00");
	});
});
