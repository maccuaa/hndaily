import type { Story } from "../types";

/**
 * Data a Theme needs to render one Digest — deliberately limited to what
 * render.ts already has available (no live schedule/heartbeat data), so
 * adding or restyling a theme never requires plumbing new state through the
 * rest of the app.
 */
export interface ThemeRenderContext {
  stories: Story[];
  isCatchup: boolean;
  dateLabel: string;
}

/**
 * A Theme owns a Digest's full visual identity: header/logo, story-row
 * layout, and footer — not just a color swap. To add a new theme, implement
 * this interface in a new file under src/themes/ and register it in
 * src/themes/index.ts; nothing else in the codebase needs to change.
 */
export interface Theme {
  /** Stable identifier used in config.json's "theme" setting — kebab-case. */
  id: string;
  /** Human-readable name, for logs/docs only. */
  name: string;
  /** Renders the complete `<!DOCTYPE html>...</html>` document for a Digest email. */
  render(context: ThemeRenderContext): string;
}
