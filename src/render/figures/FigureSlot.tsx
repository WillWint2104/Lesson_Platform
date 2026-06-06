/**
 * @file FigureSlot.tsx — the registry slot used by question components.
 *
 * Resolves (kind, specVersion) and renders the kind, a distinctly-styled
 * not-yet-implemented placeholder, or a role="alert" unknown-kind error chip.
 * Never falls back to a different kind's renderer.
 */
import type { Figure } from "@/ingest/types";
import { DEFAULT_SPEC_VERSION } from "@/ingest/figure";
import { resolveFigureRenderer } from "./registry";

function PlaceholderPanel({ kind, note }: { kind: string; note: string }) {
  return (
    <div className="qr-figure" role="img" aria-label={`${kind} figure placeholder`}>
      <span className="qr-figure__badge">{kind}</span>
      <p className="qr-figure__note">{note}</p>
    </div>
  );
}

export function FigureSlot({ figure }: { figure: Figure | null }) {
  if (!figure) {
    return <PlaceholderPanel kind="figure" note="No figure data." />;
  }
  const specVersion = figure.specVersion ?? DEFAULT_SPEC_VERSION;
  const resolution = resolveFigureRenderer(figure.kind, specVersion);

  if (resolution.status === "ok") {
    const Render = resolution.Render;
    return (
      <div className="figure-slot">
        <Render data={figure.data} />
      </div>
    );
  }

  if (resolution.status === "not-implemented") {
    return (
      <PlaceholderPanel kind={figure.kind} note="Figure rendering arrives in a later slice." />
    );
  }

  return (
    <div className="qr-error" role="alert">
      Unknown figure kind: <code>{figure.kind}</code>
    </div>
  );
}
