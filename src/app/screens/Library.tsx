import { useState } from "react";
import { Link } from "react-router-dom";
import { useRegistry } from "@/app/RegistryContext";
import { useProgressStore } from "@/state/ProgressContext";
import type { AreaRegistry, ValidatedArea } from "@/ingest/load";
import type { ProgressStore } from "@/state/progress";
import { titleCase } from "@/app/format";

/** Library hub (area model). Lists topics → areas; hero continues/starts an area. */
export function Library() {
  const registry = useRegistry();
  const subjects = registry.getSubjects();
  const [subject, setSubject] = useState<string | null>(subjects[0] ?? null);

  return (
    <main className="app-page app-page--wide lib">
      <header className="lib-header">
        <span className="lib-header__name">Lesson Platform</span>
        <span className="lib-header__identity" aria-label="Profile (placeholder)">
          LP
        </span>
      </header>

      <LocalProgressNotice />

      <section className="lib-greeting">
        <p className="lib-kicker">{todayKicker()}</p>
        <h1 className="lib-headline">Welcome back</h1>
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
        <div className="topic-placeholder">Future topics drop in as content packs.</div>
      </div>
    </main>
  );
}

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

const areaPath = (a: ValidatedArea) => `/${a.subject}/${a.topic}/${a.topicArea}`;

/** Exercise-segment completion counts for an area. */
function areaProgress(area: ValidatedArea, store: ProgressStore): { done: number; total: number } {
  let done = 0;
  let total = 0;
  area.segments.forEach((seg, i) => {
    if (seg.type !== "exercise") return;
    total += 1;
    if (store.getExerciseProgress(area.id, i)?.completedAt) done += 1;
  });
  return { done, total };
}

/**
 * Anchor (DOM id) of the first not-yet-complete exercise in an area, so the hero
 * can deep-link straight to where the learner left off. Exercises are numbered
 * independently of videos — matching the AreaPage's `exercise-N` ids. Returns
 * null when every exercise is complete (or there are none).
 */
function firstIncompleteExerciseAnchor(area: ValidatedArea, store: ProgressStore): string | null {
  let exerciseNum = 0;
  for (let i = 0; i < area.segments.length; i++) {
    if (area.segments[i]!.type !== "exercise") continue;
    exerciseNum += 1;
    if (!store.getExerciseProgress(area.id, i)?.completedAt) return `exercise-${exerciseNum}`;
  }
  return null;
}

function firstAreaOf(registry: AreaRegistry, subject: string | null): ValidatedArea | undefined {
  if (!subject) return undefined;
  for (const topic of registry.getTopics(subject)) {
    const firstValid = registry.getAreasInTopic(subject, topic).find((a) => a.valid);
    if (firstValid) return firstValid;
  }
  return undefined;
}

function Hero({ subject }: { subject: string | null }) {
  const registry = useRegistry();
  const store = useProgressStore();
  const lastId = store.getLastVisitedAreaId();
  const lastArea = lastId ? registry.getAreaById(lastId) : undefined;
  // Only continue to a *valid* last-visited area; otherwise fall back to "start here".
  const resume = lastArea?.valid ? lastArea : undefined;
  const target = resume ?? firstAreaOf(registry, subject);
  if (!target) return null;

  const kicker = resume ? "Continue where you left off" : "Start here";
  const anchor = firstIncompleteExerciseAnchor(target, store);
  const to = anchor ? `${areaPath(target)}#${anchor}` : areaPath(target);
  return (
    <Link className="hero" to={to}>
      <span className="hero__kicker">{kicker}</span>
      <span className="hero__title">{target.title}</span>
      <span className="hero__crumb">
        {titleCase(target.subject)} · {titleCase(target.topic)}
      </span>
    </Link>
  );
}

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
  const areas = registry.getAreasInTopic(subject, topic).filter((a) => a.valid);
  const totals = areas.reduce(
    (acc, a) => {
      const p = areaProgress(a, store);
      return { done: acc.done + p.done, total: acc.total + p.total };
    },
    { done: 0, total: 0 },
  );
  const pct = totals.total > 0 ? Math.round((totals.done / totals.total) * 100) : 0;

  return (
    <article className="topic-card">
      <div className="topic-card__head">
        <span className="topic-card__icon" aria-hidden="true">
          {titleCase(topic).charAt(0)}
        </span>
        <div className="topic-card__headtext">
          <h2 className="topic-card__name">{titleCase(topic)}</h2>
          <p className="topic-card__meta">
            {areas.length} area{areas.length === 1 ? "" : "s"}
          </p>
        </div>
        <span className="topic-card__pct">{pct}%</span>
      </div>

      <div className="progress" aria-hidden="true">
        <div className="progress__fill" style={{ width: `${pct}%` }} />
      </div>

      <ul className="topic-card__areas">
        {areas.map((area) => {
          const p = areaProgress(area, store);
          const kind = p.total > 0 && p.done === p.total ? "complete" : p.done > 0 ? "progress" : "idle";
          const label =
            kind === "complete" ? "Complete" : kind === "progress" ? `${p.done}/${p.total} done` : "Not started";
          const glyph = kind === "complete" ? "✓" : kind === "progress" ? "▶" : "•";
          return (
            <li key={area.id}>
              <Link className="topic-area-row" to={areaPath(area)}>
                <span
                  className={`topic-area-row__glyph topic-area-row__glyph--${kind}`}
                  aria-hidden="true"
                >
                  {glyph}
                </span>
                <span className="topic-area-row__name">{titleCase(area.topicArea)}</span>
                <span className="topic-area-row__state">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </article>
  );
}
