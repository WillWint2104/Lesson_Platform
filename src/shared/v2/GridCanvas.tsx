/**
 * @file GridCanvas.tsx — the textured page background (design-language-v2 §4).
 *
 * Fills its area with `--page` and the grid motif. All working content sits on
 * this; panels sit on the canvas. Defaults to a <div>; pass `as` to render a
 * semantic element (e.g. "main").
 */
import type { ElementType, ReactNode } from "react";

export interface GridCanvasProps {
  children?: ReactNode;
  className?: string;
  as?: ElementType;
}

export function GridCanvas({ children, className, as: Tag = "div" }: GridCanvasProps) {
  return <Tag className={["v2-canvas", className].filter(Boolean).join(" ")}>{children}</Tag>;
}
