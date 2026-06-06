/**
 * @file figure.ts — Figure normalisation + per-kind schema registry types.
 *
 * ONE resolver (CLAUDE.md §c rule 4) turns a question's figure — whether the
 * canonical `figure` field or a deprecated graphData/geometryData alias — into a
 * canonical {@link Figure} with an EXPLICIT specVersion (default stamped here, so
 * nothing downstream relies on an implicit version). Used by both the validator
 * (load-time) and the renderer.
 *
 * The per-kind schema registry is keyed by `${kind}@${specVersion}` so a kind's
 * data is validated under the exact spec it was authored for.
 */

import type { Figure } from "./types";
import type { Issue } from "./validate";

export const DEFAULT_SPEC_VERSION = 1;

/** Validates a single kind's `data` at a given specVersion. Returns issues. */
export type FigureSchemaValidator = (data: unknown, path: string) => Issue[];

/** kind@specVersion -> validator. */
export type FigureSchemaRegistry = Map<string, FigureSchemaValidator>;

export function schemaKey(kind: string, specVersion: number): string {
  return `${kind}@${specVersion}`;
}

export type FigureSource = "figure" | "graphData" | "geometryData" | "none";

export interface ResolvedFigure {
  figure: Figure | null;
  source: FigureSource;
}

/** Legacy geometry shapes → their sealed kind. Unknown shapes fall back to a
 * known-but-unimplemented kind so they render the placeholder, never an
 * unrelated kind. */
const GEOMETRY_SHAPE_KINDS: Record<string, string> = {
  triangle: "triangle-figure",
};
const GEOMETRY_FALLBACK_KIND = "geometry-figure";
const GRAPH_ALIAS_KIND = "function-graph";

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Resolve a question-like record to its canonical figure. The canonical
 * `figure` field wins; otherwise a deprecated alias is mapped to a kind. Never
 * throws; an invalid `kind` is passed through for the validator to flag.
 */
export function resolveFigure(q: Record<string, unknown>): ResolvedFigure {
  const fig = q["figure"];
  if (fig && typeof fig === "object" && !Array.isArray(fig)) {
    const record = fig as Record<string, unknown>;
    const specVersion =
      typeof record["specVersion"] === "number"
        ? (record["specVersion"] as number)
        : DEFAULT_SPEC_VERSION;
    return {
      figure: {
        kind: typeof record["kind"] === "string" ? (record["kind"] as string) : String(record["kind"]),
        specVersion,
        data: asObject(record["data"]),
      },
      source: "figure",
    };
  }

  if (q["graphData"] !== undefined) {
    return {
      figure: {
        kind: GRAPH_ALIAS_KIND,
        specVersion: DEFAULT_SPEC_VERSION,
        data: asObject(q["graphData"]),
      },
      source: "graphData",
    };
  }

  if (q["geometryData"] !== undefined) {
    const shape = asObject(q["geometryData"])["shape"];
    const kind =
      (typeof shape === "string" && GEOMETRY_SHAPE_KINDS[shape]) || GEOMETRY_FALLBACK_KIND;
    return {
      figure: { kind, specVersion: DEFAULT_SPEC_VERSION, data: asObject(q["geometryData"]) },
      source: "geometryData",
    };
  }

  return { figure: null, source: "none" };
}
