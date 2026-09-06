import { describe, expect, test } from "bun:test";

import { nightWireTheme } from "../src/themes/night-wire";
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

describe("nightWireTheme", () => {
	test("has the expected id/name", () => {
		expect(nightWireTheme.id).toBe("night-wire");
		expect(nightWireTheme.name).toBe("Night Wire");
	});

	test("labels the heading as a catch-up digest when isCatchup is true", () => {
		const html = nightWireTheme.render({
			stories: [story()],
			isCatchup: true,
			dateLabel,
			footer: footer(),
		});
		expect(html).toContain("Catch-up digest");
	});

	test("labels the heading as a daily digest when isCatchup is false", () => {
		const html = nightWireTheme.render({
			stories: [story()],
			isCatchup: false,
			dateLabel,
			footer: footer(),
		});
		expect(html).not.toContain("catch-up");
		expect(html).toContain("Daily digest");
	});

	test("links the title to the story's external URL, and shows points + comment count", () => {
		const html = nightWireTheme.render({
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
		const html = nightWireTheme.render({
			stories: [story({ hnId: 999, url: null })],
			isCatchup: false,
			dateLabel,
			footer: footer(),
		});
		expect(html).toContain('href="https://news.ycombinator.com/item?id=999"');
	});

	test("always includes a comments link to the HN discussion, separate from the title link", () => {
		const html = nightWireTheme.render({
			stories: [story({ hnId: 555, url: "https://example.com/b" })],
			isCatchup: false,
			dateLabel,
			footer: footer(),
		});
		expect(html).toContain('href="https://example.com/b"');
		expect(html).toContain('href="https://news.ycombinator.com/item?id=555"');
	});

	test("escapes story titles", () => {
		const html = nightWireTheme.render({
			stories: [story({ title: `<script>alert("x")</script>` })],
			isCatchup: false,
			dateLabel,
			footer: footer(),
		});
		expect(html).not.toContain("<script>alert");
		expect(html).toContain("&lt;script&gt;");
	});

	test("shows a friendly message when there are no stories", () => {
		const html = nightWireTheme.render({
			stories: [],
			isCatchup: false,
			dateLabel,
			footer: footer(),
		});
		expect(html).toContain("No new stories");
	});

	test("includes the wordmark", () => {
		const html = nightWireTheme.render({
			stories: [story()],
			isCatchup: false,
			dateLabel,
			footer: footer(),
		});
		expect(html).toContain("hndaily");
	});

	test("shows the hostname of the story's linked URL below the title", () => {
		const html = nightWireTheme.render({
			stories: [story({ url: "https://example.com/a" })],
			isCatchup: false,
			dateLabel,
			footer: footer(),
		});
		expect(html).toContain("example.com &middot; 100 points");
	});

	test("strips a leading www. from the displayed hostname, but keeps it in the href", () => {
		const html = nightWireTheme.render({
			stories: [story({ url: "https://www.nytimes.com/a" })],
			isCatchup: false,
			dateLabel,
			footer: footer(),
		});
		expect(html).toContain('href="https://www.nytimes.com/a"');
		expect(html).toContain(">nytimes.com &middot;");
	});

	test("shows news.ycombinator.com as the hostname for a self-post", () => {
		const html = nightWireTheme.render({
			stories: [story({ hnId: 999, url: null })],
			isCatchup: false,
			dateLabel,
			footer: footer(),
		});
		expect(html).toContain("news.ycombinator.com &middot;");
	});

	test("includes the footer settings line: recipient, generated-at, window, and next digest", () => {
		const html = nightWireTheme.render({
			stories: [story()],
			isCatchup: false,
			dateLabel,
			footer: footer({
				recipientEmail: "andrewmaccuaig@gmail.com",
				generatedAtLabel: "5 September at 14:00",
				windowStartLabel: "4 September, 14:00",
				windowEndLabel: "5 September, 14:00",
				nextDeliveryLabel: "Sunday, 6 September at 7:00",
			}),
		});
		expect(html).toContain("andrewmaccuaig@gmail.com");
		expect(html).toContain("5 September at 14:00");
		expect(html).toContain("4 September, 14:00");
		expect(html).toContain("Next digest: Sunday, 6 September at 7:00.");
		expect(html).not.toContain("a quiet daily signal");
	});
});
