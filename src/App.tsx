import { useState, type CSSProperties } from "react";
import { loadAllLessons } from "@/ingest/load";
import { NotesRenderer } from "@/render/notes/NotesRenderer";

/**
 * Scaffold smoke test + temporary ingest/notes debug harness. NOT a real screen.
 * The card proves the token pipeline; the list proves lesson discovery +
 * validation; selecting a valid lesson renders its notes via NotesRenderer.
 * Remove the debug section once real lesson routing exists.
 */

const page: CSSProperties = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "start center",
  background: "var(--page-bg)",
  fontFamily: "var(--font-body)",
  color: "var(--brand-ink)",
  padding: "2rem",
};

const card: CSSProperties = {
  background: "var(--card-bg)",
  // 2px border + 5px bottom edge construction (CLAUDE.md §d).
  border: "var(--card-border-width) solid var(--card-border)",
  borderBottomWidth: "var(--card-edge-width)",
  borderRadius: "12px",
  padding: "2rem 2.5rem",
  maxWidth: "44rem",
  width: "100%",
  textAlign: "center",
};

const heading: CSSProperties = {
  fontFamily: "var(--font-heading)",
  color: "var(--brand-ink)",
  margin: "0 0 0.5rem",
};

// --- temporary debug-harness styling (tokens only) ---
const debugSection: CSSProperties = {
  marginTop: "2rem",
  textAlign: "left",
  borderTop: "var(--card-border-width) solid var(--card-border)",
  paddingTop: "1.25rem",
};

const lessonRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.6rem",
  padding: "0.5rem 0",
  flexWrap: "wrap",
};

const selectButton: CSSProperties = {
  fontFamily: "var(--font-heading)",
  fontWeight: 700,
  fontSize: "0.8rem",
  border: "var(--card-border-width) solid var(--green-edge)",
  borderRadius: "8px",
  background: "var(--green)",
  color: "var(--card-bg)",
  padding: "0.25rem 0.7rem",
  cursor: "pointer",
};

const tagBase: CSSProperties = {
  fontFamily: "var(--font-heading)",
  fontWeight: 700,
  fontSize: "0.75rem",
  borderRadius: "999px",
  padding: "0.15rem 0.6rem",
};

const validTag: CSSProperties = { ...tagBase, background: "var(--green)", color: "var(--card-bg)" };
const issueTag: CSSProperties = { ...tagBase, background: "var(--coral)", color: "var(--coral-deep)" };

const notesPanel: CSSProperties = {
  marginTop: "1.25rem",
  paddingTop: "1.25rem",
  borderTop: "var(--card-border-width) solid var(--card-border)",
};

export default function App() {
  // Temporary: discover + validate lessons at module render. Synchronous (eager glob).
  const registry = loadAllLessons();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId ? registry.getLessonById(selectedId) : undefined;

  return (
    <main style={page}>
      <section style={card}>
        <h1 style={heading}>Lesson Platform</h1>
        <p>Vite + React + TypeScript. Notes renderer + KaTeX are live.</p>

        {/* TEMPORARY DEBUG HARNESS — remove once real lesson routing exists. */}
        <section style={debugSection}>
          <h2 style={heading}>Discovered lessons ({registry.lessons.length})</h2>
          {registry.lessons.map((lesson) => (
            <div key={lesson.path} style={lessonRow}>
              <code>{lesson.id}</code>
              <span>{lesson.title || "(untitled)"}</span>
              {lesson.valid ? (
                <>
                  <span style={validTag}>valid</span>
                  <button
                    type="button"
                    style={selectButton}
                    onClick={() => setSelectedId(lesson.id === selectedId ? null : lesson.id)}
                  >
                    {lesson.id === selectedId ? "Hide notes" : "View notes"}
                  </button>
                </>
              ) : (
                <span style={issueTag}>
                  {lesson.errors.length} error
                  {lesson.errors.length === 1 ? "" : "s"}, {lesson.warnings.length} warning
                  {lesson.warnings.length === 1 ? "" : "s"}
                  {lesson.errors[0] ? ` — ${lesson.errors[0].message}` : ""}
                </span>
              )}
            </div>
          ))}

          {selected && selected.valid ? (
            <div style={notesPanel}>
              <h3 style={heading}>{selected.title}</h3>
              <NotesRenderer blocks={selected.notes} />
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );
}
