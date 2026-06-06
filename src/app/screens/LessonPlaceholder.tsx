/**
 * @file LessonPlaceholder.tsx — TEMPORARY lesson page.
 *
 * Mounts the existing Video / Notes / Practice pieces for one lesson so the
 * Continue/Review actions have somewhere to go. The real lesson page replaces
 * this next PR. Visiting a lesson updates lastVisitedLessonId.
 */
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useRegistry } from "@/app/RegistryContext";
import { useProgressStore } from "@/state/ProgressContext";
import { titleCase, areaPath } from "@/app/format";
import { VideoEmbed } from "@/render/VideoEmbed";
import { NotesRenderer } from "@/render/notes/NotesRenderer";
import { QuestionRunner } from "@/render/questions/QuestionRunner";
import type { QuestionResult } from "@/render/questions/types";
import { NotFound } from "./NotFound";

type Tab = "video" | "notes" | "practice";

export function LessonPlaceholder() {
  const { subject, topic, topicArea, lessonId } = useParams();
  const registry = useRegistry();
  const store = useProgressStore();
  const lesson = lessonId ? registry.getLessonById(lessonId) : undefined;

  // Stale-ID + hierarchy guard: the lesson must exist AND sit at these params.
  const ok =
    !!lesson &&
    lesson.valid &&
    lesson.subject === subject &&
    lesson.topic === topic &&
    lesson.topicArea === topicArea;

  const [tab, setTab] = useState<Tab>("notes");
  const [summary, setSummary] = useState<string | null>(null);

  useEffect(() => {
    if (ok && lesson) store.setLastVisited(lesson.id);
  }, [ok, lesson, store]);

  if (!ok || !lesson) {
    return <NotFound message="That lesson doesn’t exist." />;
  }

  const onComplete = (results: QuestionResult[]) => {
    const allCorrect = results.length > 0 && results.every((r) => r.outcome === "correct");
    store.recordAttempt(lesson.id, allCorrect);
    const correct = results.filter((r) => r.outcome === "correct").length;
    setSummary(`Practice complete: ${correct}/${results.length} correct.`);
  };

  return (
    <main className="app-page lesson">
      <Link className="sel-back" to={areaPath(lesson)}>
        ← {titleCase(lesson.topicArea)}
      </Link>
      <h1 className="sel-title">{lesson.title}</h1>
      {/* TEMPORARY harness tabs — replaced by the real lesson page next PR. */}
      <div className="lesson-tabs" role="tablist" aria-label="Lesson sections">
        {(["video", "notes", "practice"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={`lesson-tab${tab === t ? " lesson-tab--active" : ""}`}
            onClick={() => {
              setSummary(null);
              setTab(t);
            }}
          >
            {titleCase(t)}
          </button>
        ))}
      </div>

      <div className="lesson-panel">
        {tab === "video" ? <VideoEmbed src={lesson.video.src} title={lesson.title} /> : null}
        {tab === "notes" ? <NotesRenderer blocks={lesson.notes} /> : null}
        {tab === "practice" ? (
          <>
            <QuestionRunner
              key={lesson.id}
              questions={lesson.questions}
              onResult={(i, o) => store.recordOutcome(lesson.id, i, o)}
              onComplete={onComplete}
            />
            {summary ? <p className="lesson-summary">{summary}</p> : null}
          </>
        ) : null}
      </div>
    </main>
  );
}
