/**
 * @file DebugHarness.tsx — dormant dev inspector at /debug (lesson 8/9; linked
 * nowhere). Lists discovered areas with validity/issues and a reset-progress
 * button. The real area UX lives on the area page.
 */
import { type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { useRegistry } from "@/app/RegistryContext";
import { useProgressStore } from "@/state/ProgressContext";

const card: CSSProperties = {
  background: "var(--card-bg)",
  border: "var(--border-flat-width) solid var(--border)", // §1 informational → flat
  borderRadius: "var(--radius-card)",
  padding: "var(--space-4)",
  maxWidth: "44rem",
  width: "100%",
};
const heading: CSSProperties = { font: "var(--text-title)", margin: "0 0 var(--space-3)" };
const row: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-3)",
  padding: "var(--space-2) 0",
  flexWrap: "wrap",
};
const resetButton: CSSProperties = {
  font: "var(--text-card-title)",
  border: "var(--card-border-width) solid var(--coral-deep)",
  borderBottomWidth: "var(--card-edge-width)", // §1 interactive → chunky
  borderRadius: "var(--radius-sm)",
  background: "var(--card-bg)",
  color: "var(--coral-deep)",
  padding: "var(--space-1) var(--space-3)",
  cursor: "pointer",
};
const tag: CSSProperties = {
  font: "var(--text-meta)",
  borderRadius: "var(--radius-pill)",
  padding: "var(--space-1) var(--space-3)",
};
const validTag: CSSProperties = { ...tag, background: "var(--green)", color: "var(--card-bg)" };
const issueTag: CSSProperties = { ...tag, background: "var(--coral)", color: "var(--coral-deep)" };

export function DebugHarness() {
  const registry = useRegistry();
  const store = useProgressStore();

  return (
    <main className="app-page">
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
                <span style={{ font: "var(--text-meta)", color: "var(--muted)" }}>
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
