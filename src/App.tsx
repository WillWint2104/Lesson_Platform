import type { CSSProperties } from "react";

/**
 * Scaffold smoke test. NOT a real screen — it only proves the token pipeline
 * works end to end (page background, card construction, primary button), all
 * driven from /styles/tokens.css. No hardcoded hex anywhere (CLAUDE.md §d).
 */

const page: CSSProperties = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  background: "var(--page-bg)",
  fontFamily: "var(--font-body)",
  color: "var(--brand-ink)",
};

const card: CSSProperties = {
  background: "var(--card-bg)",
  // 2px border + 5px bottom edge construction (CLAUDE.md §d).
  border: "var(--card-border-width) solid var(--card-border)",
  borderBottomWidth: "var(--card-edge-width)",
  borderRadius: "12px",
  padding: "2rem 2.5rem",
  maxWidth: "28rem",
  textAlign: "center",
};

const heading: CSSProperties = {
  fontFamily: "var(--font-heading)",
  color: "var(--brand-ink)",
  margin: "0 0 0.5rem",
};

const button: CSSProperties = {
  marginTop: "1.25rem",
  padding: "0.6rem 1.4rem",
  border: "none",
  borderBottom: "4px solid var(--green-edge)",
  borderRadius: "10px",
  background: "var(--green)",
  color: "var(--card-bg)",
  fontFamily: "var(--font-heading)",
  fontWeight: 700,
  fontSize: "1rem",
  cursor: "pointer",
};

export default function App() {
  return (
    <main style={page}>
      <section style={card}>
        <h1 style={heading}>Lesson Platform</h1>
        <p>Vite + React + TypeScript scaffold. Token pipeline is live.</p>
        <button type="button" style={button}>
          scaffold OK
        </button>
      </section>
    </main>
  );
}
