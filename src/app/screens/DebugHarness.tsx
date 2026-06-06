/**
 * @file DebugHarness.tsx — dormant dev inspector at /debug (lesson 8/9; linked
 * nowhere). Lists discovered areas with validity/issues and a reset-progress
 * button. The real area UX lives on the area page.
 */
import { type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { useRegistry } from "@/app/RegistryContext";
import { useProgressStore } from "@/state/ProgressContext";

const page: CSSProperties = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "start center",
  background: "var(--page-bg)",
  fontFamily: "var(--font-body)",
  color: "var(--brand-ink)",
  padding: "var(--space-6)",
};
const card: CSSProperties = {
  background: "var(--card-bg)",
  border: "var(--card-border-width) solid var(--card-border)",
  borderBottomWidth: "var(--card-edge-width)",
  borderRadius: "var(--radius-md)",
  padding: "var(--space-6)",
  maxWidth: "44rem",
  width: "100%",
};
const heading: CSSProperties = { fontFamily: "var(--font-heading)", margin: "0 0 var(--space-2)" };
const row: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-3)",
  padding: "var(--space-2) 0",
  flexWrap: "wrap",
};
const resetButton: CSSProperties = {
  fontFamily: "var(--font-heading)",
  fontWeight: 700,
  fontSize: "0.8rem",
  border: "var(--card-border-width) solid var(--coral-deep)",
  borderRadius: "var(--radius-sm)",
  background: "var(--card-bg)",
  color: "var(--coral-deep)",
  padding: "var(--space-1) var(--space-3)",
  cursor: "pointer",
};
const tag: CSSProperties = {
  fontFamily: "var(--font-heading)",
  fontWeight: 700,
  fontSize: "0.75rem",
  borderRadius: "var(--radius-pill)",
  padding: "0.15rem 0.6rem",
};
const validTag: CSSProperties = { ...tag, background: "var(--green)", color: "var(--card-bg)" };
const issueTag: CSSProperties = { ...tag, background: "var(--coral)", color: "var(--coral-deep)" };

export function DebugHarness() {
  const registry = useRegistry();
  const store = useProgressStore();

  return (
    <main style={page}>
      <section style={card}>
        <h1 style={heading}>Debug inspector</h1>
        <p>Dormant dev tool (not linked from the app). Discovered areas + validity.</p>
        <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center", flexWrap: "wrap" }}>
          <h2 style={{ ...heading, margin: 0 }}>Areas ({registry.areas.length})</h2>
          <button type="button" style={resetButton} onClick={() => store.resetAll()}>
            Reset progress
          </button>
        </div>
        {registry.areas.map((area) => (
          <div key={area.path} style={row}>
            <code>{area.id}</code>
            <span>{area.title || "(untitled)"}</span>
            {area.valid ? (
              <>
                <span style={validTag}>valid</span>
                <span style={{ fontSize: "0.8rem", color: "var(--muted-ink)" }}>
                  {area.segments.length} segment{area.segments.length === 1 ? "" : "s"}
                </span>
                <Link to={`/${area.subject}/${area.topic}/${area.topicArea}`}>open →</Link>
              </>
            ) : (
              <span style={issueTag}>
                {area.errors.length} error{area.errors.length === 1 ? "" : "s"}
                {area.errors[0] ? ` — ${area.errors[0].message}` : ""}
              </span>
            )}
          </div>
        ))}
      </section>
    </main>
  );
}
