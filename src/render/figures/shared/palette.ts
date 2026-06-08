/**
 * @file palette.ts — token → SVG colour mapping for figures (shared chrome).
 *
 * Maps semantic names to design tokens (CLAUDE.md §d). NO hardcoded hex, NO
 * problem-family meaning here — kinds decide what "accent" or "mark" means.
 *
 * v2 (design-language-v2 §2.5): figures sit on v2 surfaces, so they use the v2
 * token scale — neutral ink + ONE green accent. There is no gold/cyan in v2, so
 * `mark` and `hint` collapse onto the green accent (`--mint-ink`); shapes and
 * labels are `--ink` / `--muted`. Re-themed here (shared chrome only); the two
 * kind goldens are re-snapshotted in the same change.
 */
export const palette = {
  ink: "var(--ink)",
  stroke: "var(--ink)",
  accent: "var(--mint-ink)",
  accentEdge: "var(--mint-line)",
  muted: "var(--muted)",
  surface: "var(--surface)",
  mark: "var(--mint-ink)",
  hint: "var(--mint-ink)",
} as const;
