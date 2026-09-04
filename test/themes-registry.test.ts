import { describe, expect, test } from "bun:test";

import { DEFAULT_THEME_ID, getTheme, isValidThemeId, THEME_IDS } from "../src/themes";

describe("theme registry", () => {
	test("defaults to night-wire", () => {
		expect(DEFAULT_THEME_ID).toBe("night-wire");
	});

	test("lists both registered themes", () => {
		expect(THEME_IDS).toEqual(["night-wire", "front-page"]);
	});

	test("getTheme resolves a known id", () => {
		expect(getTheme("night-wire").name).toBe("Night Wire");
		expect(getTheme("front-page").name).toBe("Front Page");
	});

	test("getTheme throws a descriptive error for an unknown id", () => {
		expect(() => getTheme("not-a-real-theme")).toThrow(
			/Unknown theme "not-a-real-theme".*night-wire.*front-page/s,
		);
	});

	test("isValidThemeId reflects the registry", () => {
		expect(isValidThemeId("night-wire")).toBe(true);
		expect(isValidThemeId("front-page")).toBe(true);
		expect(isValidThemeId("nope")).toBe(false);
	});
});
