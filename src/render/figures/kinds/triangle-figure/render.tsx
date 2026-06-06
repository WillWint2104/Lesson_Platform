/**
 * @file render.tsx — triangle-figure renderer (specVersion 1).
 *
 * Conventions (see SPEC.md): coordinates are rendered AS GIVEN (no orientation
 * assumptions beyond a y-up projection); side/length labels are literal text
 * (lengths as given — never computed here).
 *
 * APPEND-ONLY: do not change how existing data renders. A semantics change needs
 * a NEW specVersion + a new renderer (CLAUDE.md §g). The golden snapshot guards
 * this.
 */
import { FigureCanvas, DEFAULT_VIEW_BOX } from "../../shared/FigureCanvas";
import { palette } from "../../shared/palette";
import { vertexLabelStyle, measureLabelStyle } from "../../shared/labels";
import { projectPoints, midpoint, type Point } from "../../shared/project";
import type { FigureRenderProps } from "../../types";

function readPoints(v: unknown): Point[] {
  if (!Array.isArray(v)) return [];
  const out: Point[] = [];
  for (const item of v) {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const o = item as Record<string, unknown>;
      if (typeof o["x"] === "number" && typeof o["y"] === "number") {
        out.push({ x: o["x"] as number, y: o["y"] as number });
      }
    }
  }
  return out;
}

function readStrings(v: unknown, n: number): string[] {
  if (Array.isArray(v) && v.length === n && v.every((s) => typeof s === "string")) {
    return v as string[];
  }
  return Array.from({ length: n }, () => "");
}

const round1 = (n: number) => Math.round(n * 10) / 10;

function unit(from: Point, to: Point): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

export function TriangleFigure({ data }: FigureRenderProps) {
  const verts = readPoints(data["vertices"]);
  if (verts.length !== 3) {
    return (
      <FigureCanvas ariaLabel="Triangle figure (incomplete data)">
        <text x={12} y={28} style={measureLabelStyle}>
          Incomplete triangle data
        </text>
      </FigureCanvas>
    );
  }

  const labels = readStrings(data["labels"], 3);
  const sideLabels = readStrings(data["sideLabels"], 3);
  const rightAngleAt =
    typeof data["rightAngleAt"] === "number" ? (data["rightAngleAt"] as number) : null;

  const pts = projectPoints(verts, DEFAULT_VIEW_BOX, true);
  const polygon = pts.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <FigureCanvas ariaLabel="Triangle figure">
      <polygon points={polygon} fill="none" stroke={palette.stroke} strokeWidth={2} />
      {labels.map((label, i) =>
        label ? (
          <text key={`v${i}`} x={pts[i]!.x} y={pts[i]!.y - 7} textAnchor="middle" style={vertexLabelStyle}>
            {label}
          </text>
        ) : null,
      )}
      {sideLabels.map((label, i) => {
        if (!label) return null;
        const m = midpoint(pts[i]!, pts[(i + 1) % 3]!);
        return (
          <text key={`s${i}`} x={m.x} y={m.y} textAnchor="middle" style={measureLabelStyle}>
            {label}
          </text>
        );
      })}
      {rightAngleAt !== null && pts[rightAngleAt] ? (() => {
        const at = pts[rightAngleAt]!;
        const u = unit(at, pts[(rightAngleAt + 1) % 3]!);
        const w = unit(at, pts[(rightAngleAt + 2) % 3]!);
        const s = 10;
        const p1 = `${round1(at.x + u.x * s)},${round1(at.y + u.y * s)}`;
        const p2 = `${round1(at.x + (u.x + w.x) * s)},${round1(at.y + (u.y + w.y) * s)}`;
        const p3 = `${round1(at.x + w.x * s)},${round1(at.y + w.y * s)}`;
        return (
          <polyline points={`${p1} ${p2} ${p3}`} fill="none" stroke={palette.mark} strokeWidth={1.5} />
        );
      })() : null}
    </FigureCanvas>
  );
}
