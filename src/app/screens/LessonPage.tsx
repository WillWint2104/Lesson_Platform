/**
 * @file LessonPage.tsx — the lesson page (/:subject/:topic/:topicArea/:lessonId).
 *
 * Breadcrumb → title + meta → framed VideoEmbed (coming-soon when src null) →
 * Notes/Practice tabs (default Notes). Practice resumes at the first unanswered
 * question for incomplete lessons; completed lessons open in review mode
 * (re-running records fresh outcomes + attempts but never clears completedAt).
 * The summary offers "Back to <area>" and "Next lesson →" (when unlocked).
 */
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useRegistry } from "@/app/RegistryContext";
import { useProgressStore } from "@/state/ProgressContext";
import { titleCase, areaPath, formatDuration } from "@/app/format";
import { computeUnlockStates } from "@/app/unlock";
import { VideoEmbed } from "@/render/VideoEmbed";
import { NotesRenderer } from "@/render/notes/NotesRenderer";
import { QuestionRunner } from "@/render/questions/QuestionRunner";
import type { QuestionResult } from "@/render/questions/types";
import { NotFound } from "@/app/screens/NotFound";

type Tab = "notes" | "practice";

export function LessonPage() {
  const { subject, topic, topicArea, lessonId } = useParams();
  const registry = useRegistry();
  const store = useProgressStore();
  const lesson = lessonId ? registry.getLessonById(lessonId) : undefined;

  // Stale-id + hierarchy guard: the lesson must exist AND sit at these params.
  const ok =
    !!lesson &&
    lesson.valid &&
    lesson.subject === subject &&
    lesson.topic === topic &&
    lesson.topicArea === topicArea;

  const [tab, setTab] = useState<Tab>("notes");
  // Captured ONCE at mount: was the lesson already complete when we arrived?
  // Drives the runner's seed + key so completing mid-session never remounts it.
  const [enteredCompleted] = useState(() =>
    Boolean(lessonId && store.getLessonProgress(lessonId)?.completedAt),
  );

  useEffect(() => {
    if (ok && lesson) store.setLastVisited(lesson.id);
  }, [ok, lesson, store]);

  if (!ok || !lesson) {
    return <NotFound message="That lesson doesn’t exist." />;
  }

  const record = store.getLessonProgress(lesson.id);
  const completedAt = record?.completedAt ?? null; // live (for the banner)
  // Review re-runs start fresh; incomplete lessons resume from recorded outcomes.
  const initialOutcomes = enteredCompleted ? undefined : record?.questionOutcomes;

  // Topic-area sequence → next lesson + post-completion unlock recompute.
  const areaLessons = registry
    .getTopicAreaLessons(subject!, topic!, topicArea!)
    .filter((l) => l.valid);
  const myIndex = areaLessons.findIndex((l) => l.id === lesson.id);
  const states = computeUnlockStates(
    areaLessons.map((l) => Boolean(store.getLessonProgress(l.id)?.completedAt)),
  );
  const nextLesson = myIndex >= 0 ? areaLessons[myIndex + 1] : undefined;
  const nextUnlocked = Boolean(nextLesson && states[myIndex + 1]?.unlocked);

  const summaryActions = (
    <>
      {nextLesson && nextUnlocked ? (
        <Link className="btn btn--primary" to={`${areaPath(lesson)}/${nextLesson.id}`}>
          Next lesson →
        </Link>
      ) : null}
      <Link className="btn btn--quiet" to={areaPath(lesson)}>
        Back to {titleCase(lesson.topicArea)}
      </Link>
    </>
  );

  const onComplete = (results: QuestionResult[]) => {
    const allCorrect = results.length > 0 && results.every((r) => r.outcome === "correct");
    store.recordAttempt(lesson.id, allCorrect); // never clears completedAt
  };

  const qCount = lesson.questions.length;
  const videoMeta =
    lesson.video.src === null
      ? "Video coming soon"
      : lesson.video.duration
        ? `${formatDuration(lesson.video.duration)} video`
        : "Video";

  return (
    <main className="app-page lesson">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link className="breadcrumb__link" to="/">
          {titleCase(lesson.subject)}
        </Link>{" "}
        / {titleCase(lesson.topic)} /{" "}
        <Link className="breadcrumb__link" to={areaPath(lesson)}>
          {titleCase(lesson.topicArea)}
        </Link>{" "}
        / {lesson.title}
      </nav>

      <h1 className="sel-title">{lesson.title}</h1>
      <p className="sel-sub">
        {videoMeta}
        {lesson.notes.length > 0 ? " · Notes" : ""} · {qCount} question
        {qCount === 1 ? "" : "s"}
      </p>

      {completedAt ? (
        <div className="lesson-banner">
          ✓ Completed on {completedAt.slice(0, 10)} — review mode. Re-running practice records
          fresh outcomes but keeps this lesson complete.
        </div>
      ) : null}

      <VideoEmbed src={lesson.video.src} title={lesson.title} />

      <div className="lesson-tabs" role="group" aria-label="Lesson sections">
        <button
          type="button"
          aria-pressed={tab === "notes"}
          className={`lesson-tab${tab === "notes" ? " lesson-tab--active" : ""}`}
          onClick={() => setTab("notes")}
        >
          Notes
        </button>
        <button
          type="button"
          aria-pressed={tab === "practice"}
          className={`lesson-tab${tab === "practice" ? " lesson-tab--active" : ""}`}
          onClick={() => setTab("practice")}
        >
          Practice ({qCount})
        </button>
      </div>

      <div className="lesson-panel">
        {tab === "notes" ? <NotesRenderer blocks={lesson.notes} /> : null}
        {tab === "practice" ? (
          <QuestionRunner
            key={`${lesson.id}:${enteredCompleted ? "review" : "resume"}`}
            questions={lesson.questions}
            initialOutcomes={initialOutcomes}
            summaryActions={summaryActions}
            onResult={(i, o) => store.recordOutcome(lesson.id, i, o)}
            onComplete={onComplete}
          />
        ) : null}
      </div>
    </main>
  );
}
