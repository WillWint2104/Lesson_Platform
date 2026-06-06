/**
 * @file FigurePlaceholder.tsx — honest, token-styled placeholder for graph /
 * geometry figures.
 *
 * This is a SWAPPABLE SLOT: the upcoming figure-renderer PR replaces this
 * component (same `kind` + data props) with the real canvas/SVG renderer. Until
 * then it renders a visible, labelled panel — never an empty void.
 */
export function FigurePlaceholder({ kind }: { kind: "graph" | "geometry" }) {
  const label = kind === "graph" ? "Graph" : "Geometry";
  return (
    <div className="qr-figure" role="img" aria-label={`${label} figure placeholder`}>
      <span className="qr-figure__badge">{label}</span>
      <p className="qr-figure__note">Figure rendering arrives in a later slice.</p>
    </div>
  );
}
