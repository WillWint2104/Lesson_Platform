import { useState } from "react";
import { Link } from "react-router-dom";
import { useRegistry } from "@/app/RegistryContext";
import { useProgressStore } from "@/state/ProgressContext";
import type { LessonRegistry } from "@/ingest/load";
import type { ProgressStore } from "@/state/progress";
import { titleCase, areaPath } from "@/app/format";

/** Library hub: greeting + always-present hero + responsive topic grid. */
export function Library() {
  const registry = useRegistry();
  const subjects = registry.getSubjects();
  const [subject, setSubject] = useState<string | null>(subjects[0] ?? null);

  return (
    <main className="app-page app-page--wide lib">
      <header className="lib-header">
        <span className="lib-header__name">Lesson Platform</span>
        {/* Placeholder identity chip — real profile arrives with accounts. */}
        <span className="lib-header__identity" aria-label="Profile (placeholder)">
          LP
        </span>
      </header>

      <LocalProgressNotice />

      <section className="lib-greeting">
        <p className="lib-kicker">{todayKicker()}</p>
        <h1 className="lib-headline">Welcome back</h1>
        {/* Subject pills — registry-driven, no hardcoded names. Single-select. */}
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
      </section>

      <Hero subject={subject} />

      <div className="topic-grid">
        {subject !== null
          ? registry.getTopics(subject).map((topic) => (
              <TopicCard key={topic} subject={subject} topic={topic} />
            ))
          : null}
        {/* Empty-room honesty: a one-topic library reads as "early", not broken. */}
        <div className="topic-placeholder">Future topics drop in as content packs.</div>
      </div>
    </main>
  );
}

/** "Friday · 6 June" — a quiet day/date kicker (client-only). */
function todayKicker(): string {
  try {
    return new Date().toLocaleDateString(undefined, {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  } catch {
    return "Today";
  }
}

/** First valid lesson of a subject's first topic/area (for the "start here" hero). */
function firstLessonOf(registry: LessonRegistry, subject: string | null) {
  if (!subject) return undefined;
  const topic = registry.getTopics(subject)[0];
  if (!topic) return undefined;
  const area = registry.getTopicAreas(subject, topic)[0];
  if (!area) return undefined;
  return registry.getTopicAreaLessons(subject, topic, area).find((l) => l.valid);
}

/** Hero is ALWAYS present: continue the last lesson, or start the first one. */
function Hero({ subject }: { subject: string | null }) {
  const registry = useRegistry();
  const store = useProgressStore();
  const lastId = store.getLastVisitedLessonId();
  const lastLesson = lastId ? registry.getLessonById(lastId) : undefined;
  const target = lastLesson ?? firstLessonOf(registry, subject);
  if (!target) return null; // no content at all

  const kicker = lastLesson ? "Continue where you left off" : "Start here";
  return (
    <Link className="hero" to={`${areaPath(target)}/${target.id}`}>
      <span className="hero__kicker">{kicker}</span>
      <span className="hero__title">{target.title}</span>
      <span className="hero__crumb">
        {titleCase(target.subject)} · {titleCase(target.topic)}
      </span>
    </Link>
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

const GLYPHS = { complete: "✓", progress: "▶", idle: "•" } as const;

function areaState(
  registry: LessonRegistry,
  store: ProgressStore,
  subject: string,
  topic: string,
  area: string,
): { kind: keyof typeof GLYPHS; label: string } {
  const lessons = registry.getTopicAreaLessons(subject, topic, area).filter((l) => l.valid);
  if (lessons.length === 0) return { kind: "idle", label: "No lessons yet" };
  const done = lessons.filter((l) => store.getLessonProgress(l.id)?.completedAt).length;
  if (done === lessons.length) return { kind: "complete", label: "Complete" };
  if (done > 0) return { kind: "progress", label: `${done}/${lessons.length} done` };
  return { kind: "idle", label: "Not started" };
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

      <ul className="topic-card__areas">
        {areas.map((area) => {
          const state = areaState(registry, store, subject, topic, area);
          return (
            <li key={area}>
              <Link className="topic-area-row" to={`/${subject}/${topic}/${area}`}>
                <span
                  className={`topic-area-row__glyph topic-area-row__glyph--${state.kind}`}
                  aria-hidden="true"
                >
                  {GLYPHS[state.kind]}
                </span>
                <span className="topic-area-row__name">{titleCase(area)}</span>
                <span className="topic-area-row__state">{state.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </article>
  );
}
