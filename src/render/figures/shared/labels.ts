/**
 * @file labels.ts — shared label text styles for figures (shared chrome).
 * Typography only — no problem-family conventions.
 */
import type { CSSProperties } from "react";
import { palette } from "./palette";

export const vertexLabelStyle: CSSProperties = {
  fontFamily: "var(--font-heading)",
  fontSize: "13px",
  fontWeight: 700,
  fill: palette.ink,
};

export const measureLabelStyle: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "11px",
  fill: palette.muted,
};

export const bearingLabelStyle: CSSProperties = {
  fontFamily: "var(--font-heading)",
  fontSize: "11px",
  fontWeight: 700,
  fill: palette.hint,
};
