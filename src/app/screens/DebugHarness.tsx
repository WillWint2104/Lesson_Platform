/**
 * @file DebugHarness.tsx — the original multi-lesson dev harness, retained at
 * /debug (CLAUDE.md §c lesson 8/9 — kept, tested, linked nowhere). Lets you poke
 * every lesson's notes/practice/video and reset progress without the real shell.
 */
import { useState, type CSSProperties } from "react";
import { useRegistry } from "@/app/RegistryContext";
import { useProgressStore } from "@/state/ProgressContext";
import { NotesRenderer } from "@/render/notes/NotesRenderer";
import { VideoEmbed } from "@/render/VideoEmbed";
import { QuestionRunner } from "@/render/questions/QuestionRunner";
import type { QuestionResult } from "@/render/questions/types";

type Mode = "video" | "notes" | "practice";

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
};
const heading: CSSProperties = { fontFamily: "var(--font-heading)", color: "var(--brand-ink)", margin: "0 0 0.5rem" };
const lessonRow: CSSProperties = { display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.5rem 0", flexWrap: "wrap" };
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
const resetButton: CSSProperties = { ...toggleButton, background: "var(--card-bg)", color: "var(--coral-deep)", border: "var(--card-border-width) solid var(--coral-deep)" };
const tagBase: CSSProperties = { fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: "0.75rem", borderRadius: "999px", padding: "0.15rem 0.6rem" };
const validTag: CSSProperties = { ...tagBase, background: "var(--green)", color: "var(--card-bg)" };
const issueTag: CSSProperties = { ...tagBase, background: "var(--coral)", color: "var(--coral-deep)" };
const statText: CSSProperties = { fontSize: "0.8rem", color: "var(--muted-ink)" };
const panel: CSSProperties = { marginTop: "1.25rem", paddingTop: "1.25rem", borderTop: "var(--card-border-width) solid var(--card-border)" };

export function DebugHarness() {
  const registry = useRegistry();
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
        <h1 style={heading}>Debug harness</h1>
        <p>Dormant dev tool (not linked from the app). Poke every lesson directly.</p>
        <section style={panel}>
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
                    {(["video", "notes", "practice"] as Mode[]).map((m) => (
                      <button key={m} type="button" style={toggleButton} onClick={() => toggle(lesson.id, m)}>
                        {active && mode === m ? `Hide ${m}` : m}
                      </button>
                    ))}
                    <span style={statText}>
                      {record
                        ? `${record.attempts} attempt${record.attempts === 1 ? "" : "s"} · ${correct}/${answered} correct${record.completedAt ? " · ✓ completed" : ""}`
                        : "no attempts yet"}
                    </span>
                  </>
                ) : (
                  <span style={issueTag}>
                    {lesson.errors.length} error{lesson.errors.length === 1 ? "" : "s"}
                    {lesson.errors[0] ? ` — ${lesson.errors[0].message}` : ""}
                  </span>
                )}
              </div>
            );
          })}

          {selected && selected.valid && mode === "video" ? (
            <div style={panel}>
              <VideoEmbed src={selected.video.src} title={selected.title} />
            </div>
          ) : null}
          {selected && selected.valid && mode === "notes" ? (
            <div style={panel}>
              <NotesRenderer blocks={selected.notes} />
            </div>
          ) : null}
          {selected && selected.valid && mode === "practice" ? (
            <div style={panel}>
              <QuestionRunner
                key={selected.id}
                questions={selected.questions}
                onResult={(i, o) => store.recordOutcome(selected.id, i, o)}
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
