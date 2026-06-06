/**
 * @file project.ts — generic coordinate fitting for figures (shared chrome).
 *
 * Pure layout math: fit a set of points into a view box with padding. The
 * orientation policy (whether +y points up) is the KIND's decision, passed via
 * `flipY` — this file encodes no problem-family convention.
 */
import type { FigureViewBox } from "./FigureCanvas";

export interface Point {
  x: number;
  y: number;
}

/** Round to 0.1 so snapshots are stable and diffs are readable. */
function r(n: number): number {
  return Math.round(n * 10) / 10;
}

export function projectPoints(points: Point[], viewBox: FigureViewBox, flipY = true): Point[] {
  if (points.length === 0) return [];
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const usableW = viewBox.width - 2 * viewBox.padding;
  const usableH = viewBox.height - 2 * viewBox.padding;
  const scale = Math.min(usableW / spanX, usableH / spanY);

  return points.map((p) => {
    const px = viewBox.padding + (p.x - minX) * scale;
    const py = flipY
      ? viewBox.height - viewBox.padding - (p.y - minY) * scale
      : viewBox.padding + (p.y - minY) * scale;
    return { x: r(px), y: r(py) };
  });
}

export function midpoint(a: Point, b: Point): Point {
  return { x: Math.round(((a.x + b.x) / 2) * 10) / 10, y: Math.round(((a.y + b.y) / 2) * 10) / 10 };
}
