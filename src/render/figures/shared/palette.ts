/**
 * @file palette.ts — token → SVG colour mapping for figures (shared chrome).
 *
 * Maps semantic names to design tokens (CLAUDE.md §d). NO hardcoded hex, NO
 * problem-family meaning here — kinds decide what "accent" or "mark" means.
 */
export const palette = {
  ink: "var(--brand-ink)",
  stroke: "var(--brand-ink)",
  accent: "var(--green)",
  accentEdge: "var(--green-edge)",
  muted: "var(--muted-ink)",
  surface: "var(--card-bg)",
  mark: "var(--gold-deep)",
  hint: "var(--cyan-deep)",
} as const;
