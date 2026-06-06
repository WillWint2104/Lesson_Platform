/**
 * @file FigureCanvas.tsx — shared SVG wrapper for figures.
 *
 * SHARED CHROME ONLY. This module (and everything in shared/) must contain NO
 * mathematical or problem-family conventions (no bearings, no triangle rules) —
 * just the canvas, palette, and text mechanics. Shared NEVER imports a kind.
 */
import type { ReactNode } from "react";

export interface FigureViewBox {
  width: number;
  height: number;
  padding: number;
}

export const DEFAULT_VIEW_BOX: FigureViewBox = { width: 240, height: 200, padding: 24 };

export function FigureCanvas({
  viewBox = DEFAULT_VIEW_BOX,
  ariaLabel,
  children,
}: {
  viewBox?: FigureViewBox;
  ariaLabel: string;
  children: ReactNode;
}) {
  return (
    <svg
      className="figure-canvas"
      viewBox={`0 0 ${viewBox.width} ${viewBox.height}`}
      role="img"
      aria-label={ariaLabel}
      xmlns="http://www.w3.org/2000/svg"
    >
      {children}
    </svg>
  );
}
