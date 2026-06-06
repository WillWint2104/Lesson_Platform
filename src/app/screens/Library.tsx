import { useState } from "react";
import { Link } from "react-router-dom";
import { useRegistry } from "@/app/RegistryContext";
import { useProgressStore } from "@/state/ProgressContext";
import { titleCase, areaPath } from "@/app/format";

/** Library home: subject pills + continue hero + topic cards (per approved mockup). */
export function Library() {
  const registry = useRegistry();
  const store = useProgressStore();
  const subjects = registry.getSubjects();
  const [subject, setSubject] = useState<string | null>(subjects[0] ?? null);

  const lastId = store.getLastVisitedLessonId();
  const lastLesson = lastId ? registry.getLessonById(lastId) : undefined;

  return (
    <main className="app-page lib">
      <header className="lib-header">
        <span className="lib-header__name">Lesson Platform</span>
        {/* Placeholder identity chip — real profile arrives with accounts. */}
        <span className="lib-header__identity" aria-label="Profile (placeholder)">
          LP
        </span>
      </header>

      <LocalProgressNotice />

      {/* Subject pills are driven entirely by the registry — no hardcoded names.
          Single-select segmented control (toggle buttons). */}
      <div className="lib-pills" role="group" aria-label="Subjects">
        {subjects.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={s === subject}
            className={`lib-pill${s === subject ? " lib-pill--active" : ""}`}
            onClick={() => setSubject(s)}
          >
            {titleCase(s)}
          </button>
        ))}
        <span className="lib-pill lib-pill--soon" aria-disabled="true">
          more soon
        </span>
      </div>

      {/* Continue hero — hidden when there is no last-visited lesson. Deep-links
          straight to the lesson page. */}
      {lastLesson ? (
        <Link className="lib-hero" to={`${areaPath(lastLesson)}/${lastLesson.id}`}>
          <span className="lib-hero__label">Jump back in</span>
          <span className="lib-hero__title">{lastLesson.title}</span>
          <span className="lib-hero__crumb">
            {titleCase(lastLesson.subject)} · {titleCase(lastLesson.topic)}
          </span>
        </Link>
      ) : null}

      <div className="lib-topics">
        {subject === null ? (
          <p>No subjects available yet.</p>
        ) : (
          registry.getTopics(subject).map((topic) => (
            <TopicCard key={topic} subject={subject} topic={topic} />
          ))
        )}
      </div>
    </main>
  );
}

/**
 * One-time, dismissible "your progress is local to this browser" notice
 * (soft-launch). Dismissal persists through the progress store's storage layer.
 */
function LocalProgressNotice() {
  const store = useProgressStore();
  if (store.isNoticeDismissed("local-progress")) return null;
  return (
    <aside className="notice" role="note">
      <p className="notice__text">
        Your progress is saved in this browser on this device. Clearing site data or switching
        devices starts fresh.
      </p>
      <button
        type="button"
        className="notice__dismiss"
        onClick={() => store.dismissNotice("local-progress")}
      >
        Dismiss
      </button>
    </aside>
  );
}

function TopicCard({ subject, topic }: { subject: string; topic: string }) {
  const registry = useRegistry();
  const store = useProgressStore();
  const areas = registry.getTopicAreas(subject, topic);
  const total = registry.lessons.filter((l) => l.subject === subject && l.topic === topic).length;
  const progress = store.getTopicProgress(subject, topic);
  const pct = total > 0 ? Math.round((progress.completedCount / total) * 100) : 0;

  return (
    <article className="topic-card">
      <div className="topic-card__head">
        <span className="topic-card__icon" aria-hidden="true">
          {titleCase(topic).charAt(0)}
        </span>
        <div className="topic-card__headtext">
          <h2 className="topic-card__name">{titleCase(topic)}</h2>
          <p className="topic-card__meta">
            {areas.length} area{areas.length === 1 ? "" : "s"} · {total} lesson
            {total === 1 ? "" : "s"}
          </p>
        </div>
        <span className="topic-card__pct">{pct}%</span>
      </div>

      <div className="progress" aria-hidden="true">
        <div className="progress__fill" style={{ width: `${pct}%` }} />
      </div>

      {areas.length > 1 ? (
        // Multiple areas: list them as rows (the topic page is future work).
        <ul className="topic-card__areas">
          {areas.map((area) => (
            <li key={area}>
              <Link className="area-row" to={`/${subject}/${topic}/${area}`}>
                {titleCase(area)}
              </Link>
            </li>
          ))}
        </ul>
      ) : areas[0] ? (
        <Link className="topic-card__link" to={`/${subject}/${topic}/${areas[0]}`}>
          Open {titleCase(areas[0])}
        </Link>
      ) : null}
    </article>
  );
}
