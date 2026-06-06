/**
 * @file registry.ts — sealed kind → renderer/schema resolution.
 *
 * Dispatches on (kind, specVersion). There is NO fallback rendering across
 * kinds — an unknown kind is an error, never "best effort with another kind".
 * Known-but-unimplemented kinds (e.g. deprecated aliases) resolve to the
 * not-implemented placeholder, which is visually distinct from the error chip.
 */
import { schemaKey, type FigureSchemaRegistry } from "@/ingest/figure";
import type { FigureKind, FigureRenderer } from "./types";
import { triangleFigureKind } from "./kinds/triangle-figure";
import { bearingDiagramKind } from "./kinds/bearing-diagram";

const KINDS: FigureKind[] = [triangleFigureKind, bearingDiagramKind];

/** Kinds that exist as concepts but have no renderer yet (→ placeholder). */
export const PLANNED_KINDS = new Set<string>(["function-graph", "geometry-figure"]);

const byKey = new Map<string, FigureKind>();
const knownKinds = new Set<string>(PLANNED_KINDS);
for (const k of KINDS) {
  byKey.set(schemaKey(k.kind, k.specVersion), k);
  knownKinds.add(k.kind);
}

export type FigureResolution =
  | { status: "ok"; Render: FigureRenderer }
  | { status: "not-implemented"; kind: string; specVersion: number }
  | { status: "unknown"; kind: string };

export function resolveFigureRenderer(kind: string, specVersion: number): FigureResolution {
  const exact = byKey.get(schemaKey(kind, specVersion));
  if (exact) return { status: "ok", Render: exact.Render };
  if (knownKinds.has(kind)) return { status: "not-implemented", kind, specVersion };
  return { status: "unknown", kind };
}

/** The per-kind schema registry to hand to the ingest validator/loader. */
export const figureSchemas: FigureSchemaRegistry = new Map(
  KINDS.map((k) => [schemaKey(k.kind, k.specVersion), k.schema]),
);
