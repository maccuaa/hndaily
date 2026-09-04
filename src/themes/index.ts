import { frontPageTheme } from "./front-page";
import { nightWireTheme } from "./night-wire";
import type { Theme } from "./types";

export type { Theme, ThemeRenderContext } from "./types";

/**
 * Theme registry. To add a new theme: implement `Theme` in a new file next
 * to night-wire.ts/front-page.ts, then add it to this list — nothing else
 * in the codebase (render.ts, config.ts) needs to change.
 */
const THEMES: readonly Theme[] = [nightWireTheme, frontPageTheme];

/** Config.theme falls back to this when a config.json predates the theme setting. */
export const DEFAULT_THEME_ID: string = nightWireTheme.id;

const THEMES_BY_ID: ReadonlyMap<string, Theme> = new Map(THEMES.map((theme) => [theme.id, theme]));

/** All known theme ids, for config validation error messages. */
export const THEME_IDS: readonly string[] = THEMES.map((theme) => theme.id);

export function isValidThemeId(id: string): boolean {
	return THEMES_BY_ID.has(id);
}

export function getTheme(id: string): Theme {
	const theme = THEMES_BY_ID.get(id);
	if (!theme) {
		throw new Error(`Unknown theme "${id}" — must be one of: ${THEME_IDS.join(", ")}`);
	}
	return theme;
}
