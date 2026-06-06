/**
 * @file render.tsx — bearing-diagram renderer (specVersion 1).
 *
 * Conventions (see SPEC.md): NORTH is UP; a north arrow is drawn at every point;
 * bearings are labelled as THREE-FIGURE bearings (e.g. "045°") measured CLOCKWISE
 * FROM NORTH. The `degrees` value is shown AS GIVEN — never recomputed from the
 * point coordinates.
 *
 * APPEND-ONLY: a semantics change needs a NEW specVersion (CLAUDE.md §g); the
 * golden snapshot guards this.
 */
import { FigureCanvas, DEFAULT_VIEW_BOX } from "../../shared/FigureCanvas";
import { palette } from "../../shared/palette";
import { vertexLabelStyle, measureLabelStyle, bearingLabelStyle } from "../../shared/labels";
import { projectPoints, midpoint, type Point } from "../../shared/project";
import type { FigureRenderProps } from "../../types";

interface BearingPoint {
  id: string;
  x: number;
  y: number;
  label?: string;
}
interface Bearing {
  from: string;
  to: string;
  degrees: number;
}

function readPoints(v: unknown): BearingPoint[] {
  if (!Array.isArray(v)) return [];
  const out: BearingPoint[] = [];
  for (const item of v) {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const o = item as Record<string, unknown>;
      if (typeof o["id"] === "string" && typeof o["x"] === "number" && typeof o["y"] === "number") {
        out.push({
          id: o["id"] as string,
          x: o["x"] as number,
          y: o["y"] as number,
          label: typeof o["label"] === "string" ? (o["label"] as string) : undefined,
        });
      }
    }
  }
  return out;
}

function readBearings(v: unknown): Bearing[] {
  if (!Array.isArray(v)) return [];
  const out: Bearing[] = [];
  for (const item of v) {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const o = item as Record<string, unknown>;
      if (typeof o["from"] === "string" && typeof o["to"] === "string" && typeof o["degrees"] === "number") {
        out.push({ from: o["from"] as string, to: o["to"] as string, degrees: o["degrees"] as number });
      }
    }
  }
  return out;
}

/** Three-figure bearing label, e.g. 45 → "045°". */
export function threeFigureBearing(degrees: number): string {
  if (!Number.isFinite(degrees)) return "—";
  const d = ((Math.round(degrees) % 360) + 360) % 360;
  return `${String(d).padStart(3, "0")}°`;
}

export function BearingDiagram({ data }: FigureRenderProps) {
  const points = readPoints(data["points"]);
  if (points.length === 0) {
    return (
      <FigureCanvas ariaLabel="Bearing diagram (incomplete data)">
        <text x={12} y={28} style={measureLabelStyle}>
          Incomplete bearing data
        </text>
      </FigureCanvas>
    );
  }

  const projected = projectPoints(
    points.map((p) => ({ x: p.x, y: p.y })),
    DEFAULT_VIEW_BOX,
    true,
  );
  const byId = new Map<string, Point>();
  points.forEach((p, i) => byId.set(p.id, projected[i]!));
  const bearings = readBearings(data["bearings"]);

  return (
    <FigureCanvas ariaLabel="Bearing diagram">
      {bearings.map((b, i) => {
        const from = byId.get(b.from);
        const to = byId.get(b.to);
        if (!from || !to) return null;
        const m = midpoint(from, to);
        return (
          <g key={`b${i}`}>
            <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={palette.accent} strokeWidth={1.5} />
            <text x={m.x} y={m.y - 4} textAnchor="middle" style={bearingLabelStyle}>
              {threeFigureBearing(b.degrees)}
            </text>
          </g>
        );
      })}
      {points.map((p, i) => {
        const c = projected[i]!;
        return (
          <g key={p.id}>
            {/* North arrow (up) — the bearing reference direction. */}
            <line x1={c.x} y1={c.y} x2={c.x} y2={c.y - 18} stroke={palette.muted} strokeWidth={1} />
            <text x={c.x + 3} y={c.y - 17} style={measureLabelStyle}>
              N
            </text>
            <circle cx={c.x} cy={c.y} r={3} fill={palette.ink} />
            <text x={c.x + 6} y={c.y + 5} style={vertexLabelStyle}>
              {p.label ?? p.id}
            </text>
          </g>
        );
      })}
    </FigureCanvas>
  );
}
