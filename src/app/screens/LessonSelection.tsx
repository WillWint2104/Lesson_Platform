import { Link, useParams } from "react-router-dom";
import { useRegistry } from "@/app/RegistryContext";
import { useProgressStore } from "@/state/ProgressContext";
import type { ProgressStore } from "@/state/progress";
import type { ValidatedLesson } from "@/ingest/load";
import { computeUnlockStates, type LessonStatus } from "@/app/unlock";
import { titleCase, formatDuration } from "@/app/format";
import { NotFound } from "@/app/screens/NotFound";

/** Topic-area lesson list (per approved mockup; canonical spec in /docs). */
export function LessonSelection() {
  const { subject, topic, topicArea } = useParams();
  const registry = useRegistry();
  const store = useProgressStore();

  // Stale-ID guard (lesson 7): route params are stored-id-like input.
  if (!subject || !topic || !topicArea) {
    return <NotFound message="That topic area doesn’t exist." />;
  }
  const lessons = registry
    .getTopicAreaLessons(subject, topic, topicArea)
    .filter((l) => l.valid);
  if (lessons.length === 0) {
    return <NotFound message="That topic area doesn’t exist." />;
  }

  const completed = lessons.map((l) => Boolean(store.getLessonProgress(l.id)?.completedAt));
  const states = computeUnlockStates(completed);
  const completedCount = completed.filter(Boolean).length;
  const pct = Math.round((completedCount / lessons.length) * 100);

  return (
    <main className="app-page sel">
      <Link className="sel-back" to="/">
        ← Library
      </Link>
      <nav className="breadcrumb" aria-label="Breadcrumb">
        {titleCase(subject)} / {titleCase(topic)} / {titleCase(topicArea)}
      </nav>
      <h1 className="sel-title">{titleCase(topicArea)}</h1>
      <p className="sel-sub">
        {lessons.length} lesson{lessons.length === 1 ? "" : "s"} · then the topic checkpoint ·{" "}
        {pct}%
      </p>
      <div className="progress" aria-hidden="true">
        <div className="progress__fill" style={{ width: `${pct}%` }} />
      </div>

      <ol className="sel-list">
        {lessons.map((lesson, i) => (
          <LessonCard
            key={lesson.id}
            lesson={lesson}
            number={i + 1}
            status={states[i]!.status}
            store={store}
            basePath={`/${subject}/${topic}/${topicArea}`}
          />
        ))}
      </ol>

      <CheckpointCard lessonCount={lessons.length} />
    </main>
  );
}

function StatusCircle({ status, number }: { status: LessonStatus; number: number }) {
  if (status === "done") {
    return (
      <span className="status-circle status-circle--done" aria-label="Completed">
        ✓
      </span>
    );
  }
  if (status === "current") {
    return (
      <span className="status-circle status-circle--current" aria-label="Current lesson">
        ▶
      </span>
    );
  }
  return (
    <span className="status-circle status-circle--locked" aria-label={`Lesson ${number}, locked`}>
      {number}
    </span>
  );
}

function LessonCard({
  lesson,
  number,
  status,
  store,
  basePath,
}: {
  lesson: ValidatedLesson;
  number: number;
  status: LessonStatus;
  store: ProgressStore;
  basePath: string;
}) {
  const record = store.getLessonProgress(lesson.id);
  const lessonPath = `${basePath}/${lesson.id}`;

  const videoMeta =
    lesson.video.src === null
      ? "Video coming soon"
      : lesson.video.duration
        ? `${formatDuration(lesson.video.duration)} video`
        : "Video";
  const qCount = lesson.questions.length;
  const meta = [
    videoMeta,
    lesson.notes.length > 0 ? "Notes" : null,
    `${qCount} question${qCount === 1 ? "" : "s"}`,
    record?.completedAt
      ? "Completed"
      : record
        ? `${Object.values(record.questionOutcomes).filter((o) => o === "correct").length}/${Object.keys(record.questionOutcomes).length} correct`
        : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className={`lesson-card lesson-card--${status}`}>
      <StatusCircle status={status} number={number} />
      <div className="lesson-card__body">
        <h3 className="lesson-card__title">
          {number} · {lesson.title}
        </h3>
        <p className="lesson-card__meta">{meta}</p>
      </div>
      <div className="lesson-card__action">
        {status === "done" ? (
          <Link
            className="btn btn--quiet"
            to={lessonPath}
            onClick={() => store.setLastVisited(lesson.id)}
          >
            Review
          </Link>
        ) : status === "current" ? (
          <Link
            className="btn btn--primary"
            to={lessonPath}
            onClick={() => store.setLastVisited(lesson.id)}
          >
            Continue
          </Link>
        ) : (
          <span className="lesson-card__locked">Complete lesson {number - 1} to unlock</span>
        )}
      </div>
    </li>
  );
}

function CheckpointCard({ lessonCount }: { lessonCount: number }) {
  return (
    <section className="checkpoint-card" aria-label="Topic checkpoint (locked)">
      <span className="checkpoint-card__trophy" aria-hidden="true">
        ★
      </span>
      <div className="checkpoint-card__body">
        <h3 className="checkpoint-card__title">Topic checkpoint</h3>
        <p className="checkpoint-card__meta">
          Mixed questions from this topic only · unlocks after lesson {lessonCount}
        </p>
      </div>
      <span className="checkpoint-card__lock">Locked</span>
    </section>
  );
}
