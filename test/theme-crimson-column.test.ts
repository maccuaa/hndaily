import { describe, expect, test } from "bun:test";

import { crimsonColumnTheme } from "../src/themes/crimson-column";
import type { ThemeFooterContext } from "../src/themes/types";
import type { Story } from "../src/types";

function story(overrides: Partial<Story> = {}): Story {
	return {
		hnId: 1,
		title: "A story",
		url: "https://example.com/a",
		points: 100,
		numComments: 10,
		createdAt: 1_700_000_000,
		...overrides,
	};
}

// crimson-column doesn't render footer settings (see night-wire), but every
// Theme shares the same ThemeRenderContext shape, so this fixture is still
// required.
function footer(overrides: Partial<ThemeFooterContext> = {}): ThemeFooterContext {
	return {
		recipientEmail: "you@example.com",
		generatedAtLabel: "5 September at 14:00",
		windowStartLabel: "4 September, 14:00",
		windowEndLabel: "5 September, 14:00",
		nextDeliveryLabel: "Sunday, 6 September at 7:00",
		...overrides,
	};
}

const dateLabel = "5 January";

describe("crimsonColumnTheme", () => {
	test("has the expected id/name", () => {
		expect(crimsonColumnTheme.id).toBe("crimson-column");
		expect(crimsonColumnTheme.name).toBe("Crimson Column");
	});

	test("includes the masthead wordmark", () => {
		const html = crimsonColumnTheme.render({
			stories: [story()],
			isCatchup: false,
			dateLabel,
			footer: footer(),
		});
		expect(html).toContain("HN Daily");
	});

	test("shows the catch-up eyebrow when isCatchup is true", () => {
		const html = crimsonColumnTheme.render({
			stories: [story()],
			isCatchup: true,
			dateLabel,
			footer: footer(),
		});
		expect(html).toContain("CATCH-UP BRIEFING");
	});

	test("shows the daily-briefing eyebrow when isCatchup is false", () => {
		const html = crimsonColumnTheme.render({
			stories: [story()],
			isCatchup: false,
			dateLabel,
			footer: footer(),
		});
		expect(html).not.toContain("CATCH-UP");
		expect(html).toContain("TODAY'S BRIEFING");
	});

	test("renders every story uniformly — no distinct lead-story treatment", () => {
		const html = crimsonColumnTheme.render({
			stories: [story({ hnId: 1 }), story({ hnId: 2 }), story({ hnId: 3 })],
			isCatchup: false,
			dateLabel,
			footer: footer(),
		});
		expect(html).not.toContain("TOP STORY");
		const titleFontSizes = [...html.matchAll(/font-size: (\d+)px; text-decoration: none;/g)].map(
			(m) => m[1],
		);
		expect(titleFontSizes).toEqual(["16", "16", "16"]);
	});

	test("links the title to the story's external URL, and shows points + comment count", () => {
		const html = crimsonColumnTheme.render({
			stories: [story({ url: "https://example.com/a", points: 250, numComments: 42 })],
			isCatchup: false,
			dateLabel,
			footer: footer(),
		});
		expect(html).toContain('href="https://example.com/a"');
		expect(html).toContain("250 points");
		expect(html).toContain("42 comments");
	});

	test("links the title to the HN discussion when there's no external URL (self-post)", () => {
		const html = crimsonColumnTheme.render({
			stories: [story({ hnId: 999, url: null })],
			isCatchup: false,
			dateLabel,
			footer: footer(),
		});
		expect(html).toContain('href="https://news.ycombinator.com/item?id=999"');
	});

	test("always includes a comments link to the HN discussion, separate from the title link", () => {
		const html = crimsonColumnTheme.render({
			stories: [story({ hnId: 555, url: "https://example.com/b" })],
			isCatchup: false,
			dateLabel,
			footer: footer(),
		});
		expect(html).toContain('href="https://example.com/b"');
		expect(html).toContain('href="https://news.ycombinator.com/item?id=555"');
	});

	test("shows the hostname of the story's linked URL", () => {
		const html = crimsonColumnTheme.render({
			stories: [story({ url: "https://www.nytimes.com/a" })],
			isCatchup: false,
			dateLabel,
			footer: footer(),
		});
		expect(html).toContain("nytimes.com &middot; 100 points");
	});

	test("escapes story titles", () => {
		const html = crimsonColumnTheme.render({
			stories: [story({ title: `<script>alert("x")</script>` })],
			isCatchup: false,
			dateLabel,
			footer: footer(),
		});
		expect(html).not.toContain("<script>alert");
		expect(html).toContain("&lt;script&gt;");
	});

	test("shows a friendly message when there are no stories", () => {
		const html = crimsonColumnTheme.render({
			stories: [],
			isCatchup: false,
			dateLabel,
			footer: footer(),
		});
		expect(html).toContain("No new stories");
	});
});
