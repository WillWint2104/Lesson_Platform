import { useMemo, useState, type CSSProperties } from "react";
import { loadAllLessons } from "@/ingest/load";
import { NotesRenderer } from "@/render/notes/NotesRenderer";
import { QuestionRunner } from "@/render/questions/QuestionRunner";
import type { QuestionResult } from "@/render/questions/types";
import { createProgressStore } from "@/state/progress";
import { ProgressProvider, useProgressStore } from "@/state/ProgressContext";
import { figureSchemas } from "@/render/figures/registry";

/**
 * Scaffold smoke test + temporary debug harness. NOT a real screen. Proves
 * lesson discovery + validation, the notes/question renderers, AND the progress
 * store (per-lesson counts + reset). Remove once real routing exists.
 */

type Mode = "notes" | "practice";

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

const toggleButton: CSSProperties = {
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

const resetButton: CSSProperties = {
  ...toggleButton,
  background: "var(--card-bg)",
  color: "var(--coral-deep)",
  border: "var(--card-border-width) solid var(--coral-deep)",
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
const statText: CSSProperties = { fontSize: "0.8rem", color: "var(--muted-ink)" };

const panel: CSSProperties = {
  marginTop: "1.25rem",
  paddingTop: "1.25rem",
  borderTop: "var(--card-border-width) solid var(--card-border)",
};

export default function App() {
  const registry = useMemo(() => loadAllLessons({ figureSchemas }), []);
  const store = useMemo(
    () =>
      createProgressStore({
        lessons: registry.lessons.map((l) => ({
          id: l.id,
          subject: l.subject,
          topic: l.topic,
          topicArea: l.topicArea,
          questions: l.questions.map((q) => ({ skill: q.skill, difficulty: q.difficulty })),
        })),
      }),
    [registry],
  );

  return (
    <ProgressProvider store={store}>
      <Harness registry={registry} />
    </ProgressProvider>
  );
}

function Harness({ registry }: { registry: ReturnType<typeof loadAllLessons> }) {
  const store = useProgressStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  const selected = selectedId ? registry.getLessonById(selectedId) : undefined;

  const toggle = (id: string, next: Mode) => {
    setSummary(null);
    if (selectedId === id && mode === next) {
      setSelectedId(null);
      setMode(null);
    } else {
      setSelectedId(id);
      setMode(next);
      store.setLastVisited(id);
    }
  };

  const handleResult = (index: number, outcome: QuestionResult["outcome"]) => {
    if (selected) store.recordOutcome(selected.id, index, outcome);
  };

  const handleComplete = (results: QuestionResult[]) => {
    if (!selected) return;
    const allCorrect = results.length > 0 && results.every((r) => r.outcome === "correct");
    store.recordAttempt(selected.id, allCorrect);
    const correct = results.filter((r) => r.outcome === "correct").length;
    setSummary(`Practice complete: ${correct}/${results.length} correct.`);
  };

  return (
    <main style={page}>
      <section style={card}>
        <h1 style={heading}>Lesson Platform</h1>
        <p>Vite + React + TypeScript. Notes, question runtime, and progress are live.</p>

        {/* TEMPORARY DEBUG HARNESS — remove once real lesson routing exists. */}
        <section style={debugSection}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
            <h2 style={{ ...heading, margin: 0 }}>Discovered lessons ({registry.lessons.length})</h2>
            <button type="button" style={resetButton} onClick={() => store.resetAll()}>
              Reset progress
            </button>
          </div>

          {registry.lessons.map((lesson) => {
            const active = lesson.id === selectedId;
            const record = store.getLessonProgress(lesson.id);
            const correct = record
              ? Object.values(record.questionOutcomes).filter((o) => o === "correct").length
              : 0;
            const answered = record ? Object.keys(record.questionOutcomes).length : 0;
            return (
              <div key={lesson.path} style={lessonRow}>
                <code>{lesson.id}</code>
                <span>{lesson.title || "(untitled)"}</span>
                {lesson.valid ? (
                  <>
                    <span style={validTag}>valid</span>
                    <button type="button" style={toggleButton} onClick={() => toggle(lesson.id, "notes")}>
                      {active && mode === "notes" ? "Hide notes" : "Notes"}
                    </button>
                    <button type="button" style={toggleButton} onClick={() => toggle(lesson.id, "practice")}>
                      {active && mode === "practice" ? "Hide practice" : "Practice"}
                    </button>
                    <span style={statText}>
                      {record
                        ? `${record.attempts} attempt${record.attempts === 1 ? "" : "s"} · ${correct}/${answered} correct${record.completedAt ? " · ✓ completed" : ""}`
                        : "no attempts yet"}
                    </span>
                  </>
                ) : (
                  <span style={issueTag}>
                    {lesson.errors.length} error
                    {lesson.errors.length === 1 ? "" : "s"}
                    {lesson.errors[0] ? ` — ${lesson.errors[0].message}` : ""}
                  </span>
                )}
              </div>
            );
          })}

          {selected && selected.valid && mode === "notes" ? (
            <div style={panel}>
              <h3 style={heading}>{selected.title}</h3>
              <NotesRenderer blocks={selected.notes} />
            </div>
          ) : null}

          {selected && selected.valid && mode === "practice" ? (
            <div style={panel}>
              <h3 style={heading}>{selected.title} — practice</h3>
              <QuestionRunner
                key={selected.id}
                questions={selected.questions}
                onResult={handleResult}
                onComplete={handleComplete}
              />
              {summary ? <p style={{ marginTop: "0.8rem", fontWeight: 600 }}>{summary}</p> : null}
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );
}
