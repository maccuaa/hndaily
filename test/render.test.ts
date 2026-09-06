import { describe, expect, test } from "bun:test";

import { escapeHtml, renderDigest } from "../src/render";
import type { RenderOptions } from "../src/render";
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

function renderOptions(overrides: Partial<RenderOptions> = {}): RenderOptions {
	return {
		isCatchup: false,
		recipientEmail: "you@example.com",
		schedule: { cron: "0 7 * * *", timezone: "UTC" },
		windowStart: Math.floor(Date.now() / 1000) - 86_400,
		...overrides,
	};
}

describe("escapeHtml", () => {
	test("escapes the five special characters", () => {
		expect(escapeHtml(`<a href="x">Tom & Jerry's "Show"</a>`)).toBe(
			"&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s &quot;Show&quot;&lt;/a&gt;",
		);
	});
});

describe("renderDigest", () => {
	test("labels the subject/heading as a catch-up digest when isCatchup is true", () => {
		const { subject, html } = renderDigest([story()], renderOptions({ isCatchup: true }));
		expect(subject).toContain("catch-up");
		expect(html).toContain("Catch-up digest");
	});

	test("labels the subject/heading as a regular digest when isCatchup is false", () => {
		const { subject, html } = renderDigest([story()], renderOptions());
		expect(subject).not.toContain("catch-up");
		expect(html).toContain("Daily digest");
	});

	test("links the title to the story's external URL, shows points + comment count, and the hostname", () => {
		const { html } = renderDigest(
			[story({ url: "https://example.com/a", points: 250, numComments: 42 })],
			renderOptions(),
		);
		expect(html).toContain('href="https://example.com/a"');
		expect(html).toContain("example.com &middot;");
		expect(html).toContain("250 points");
		expect(html).toContain("42 comments");
	});

	test("links the title to the HN discussion when there's no external URL (self-post)", () => {
		const { html } = renderDigest([story({ hnId: 999, url: null })], renderOptions());
		expect(html).toContain('href="https://news.ycombinator.com/item?id=999"');
	});

	test("always includes a comments link to the HN discussion, separate from the title link", () => {
		const { html } = renderDigest(
			[story({ hnId: 555, url: "https://example.com/b" })],
			renderOptions(),
		);
		expect(html).toContain('href="https://example.com/b"');
		expect(html).toContain('href="https://news.ycombinator.com/item?id=555"');
	});

	test("escapes story titles", () => {
		const { html } = renderDigest(
			[story({ title: `<script>alert("x")</script>` })],
			renderOptions(),
		);
		expect(html).not.toContain("<script>alert");
		expect(html).toContain("&lt;script&gt;");
	});

	test("shows a friendly message when there are no stories", () => {
		const { html } = renderDigest([], renderOptions());
		expect(html).toContain("No new stories");
	});

	test("defaults to the Night Wire theme when options.theme is omitted", () => {
		const { html } = renderDigest([story()], renderOptions());
		expect(html).toContain("hndaily");
	});

	test("renders with the Front Page theme when options.theme is set", () => {
		const { html } = renderDigest([story()], renderOptions({ theme: "front-page" }));
		expect(html).toContain("HN DAILY");
	});

	test("throws a descriptive error for an unknown theme", () => {
		expect(() => renderDigest([story()], renderOptions({ theme: "not-a-real-theme" }))).toThrow(
			/Unknown theme "not-a-real-theme"/,
		);
	});

	test("keeps the subject line theme-agnostic", () => {
		const { subject } = renderDigest([story()], renderOptions({ theme: "front-page" }));
		expect(subject).toMatch(/^HN Daily — /);
	});

	test("includes the footer settings line: recipient email and next digest time", () => {
		const { html } = renderDigest(
			[story()],
			renderOptions({ recipientEmail: "andrewmaccuaig@gmail.com" }),
		);
		expect(html).toContain("andrewmaccuaig@gmail.com");
		expect(html).toContain("Next digest:");
	});

	test("formats the header date label and footer timestamps in the schedule's timezone", () => {
		const { html } = renderDigest(
			[story()],
			renderOptions({ schedule: { cron: "0 7 * * *", timezone: "America/Toronto" } }),
		);
		// Day-month, no year (e.g. "5 September") — not the old "September 5, 2026" style.
		expect(html).toMatch(/\d{1,2} [A-Z][a-z]+</);
	});
});
