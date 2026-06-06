/**
 * @file types.ts — the sealed-kind registration contract.
 *
 * Each figure kind exports a FigureKind. The registry dispatches on
 * (kind, specVersion). Kinds NEVER import sibling kinds; shared NEVER imports
 * kinds (enforced by the structural test). Specs are append-only (CLAUDE.md §g).
 */
import type { ReactElement } from "react";
import type { FigureSchemaValidator } from "@/ingest/figure";

export interface FigureRenderProps {
  data: Record<string, unknown>;
}

export type FigureRenderer = (props: FigureRenderProps) => ReactElement;

export interface FigureKind {
  kind: string;
  specVersion: number;
  /** Validates this kind's `data` at this specVersion (path-precise issues). */
  schema: FigureSchemaValidator;
  /** Renders this kind's `data`. */
  Render: FigureRenderer;
}
