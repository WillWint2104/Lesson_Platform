import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useRegistry } from "@/app/RegistryContext";
import { useProgressStore } from "@/state/ProgressContext";
import type { AreaRegistry, ValidatedArea } from "@/ingest/load";
import type { ProgressStore } from "@/state/progress";
import { titleCase } from "@/app/format";
import { StatusCircle } from "@/shared/StatusCircle";

/** Library hub (area model). Lists topics → areas; hero continues/starts an area. */
export function Library() {
  const registry = useRegistry();
  const subjects = registry.getSubjects();
  const [subject, setSubject] = useState<string | null>(subjects[0] ?? null);

  return (
    <main className="app-page lib">
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

      <div className="hub">
        <div className="hub__main">
          <Hero subject={subject} />
          <section className="area-section" aria-label="Topics">
            <p className="section-label">Topics</p>
            <div className="topic-grid">
              {subject !== null
                ? registry.getTopics(subject).map((topic) => (
                    <TopicCard key={topic} subject={subject} topic={topic} />
                  ))
                : null}
              <div className="topic-placeholder">Future topics drop in as content packs.</div>
            </div>
          </section>
        </div>
        <aside className="hub__rail" aria-label="Hub sidebar">
          <RailUpNext />
          <RailProgress />
          <RailHowItWorks />
        </aside>
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
      <span className="hero__text">
        <span className="hero__kicker">{kicker}</span>
        <span className="hero__title">{target.title}</span>
        <span className="hero__crumb">
          {titleCase(target.subject)} · {titleCase(target.topic)}
        </span>
      </span>
      <span className="hero__cta" aria-hidden="true">
        Open <ArrowRight size={16} />
      </span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Rail (hub sidebar) — flat informational cards (§1/§4).
// ---------------------------------------------------------------------------

interface UpNext {
  title: string;
  questionCount: number;
  afterVideo: number | null;
  to: string;
}

/** First incomplete exercise across the registry, in order (null if all done). */
function findUpNext(registry: AreaRegistry, store: ProgressStore): UpNext | null {
  for (const area of registry.areas.filter((a) => a.valid)) {
    let exerciseNum = 0;
    let videoNum = 0;
    for (let i = 0; i < area.segments.length; i++) {
      const seg = area.segments[i]!;
      if (seg.type === "video") {
        videoNum += 1;
        continue;
      }
      exerciseNum += 1;
      if (!store.getExerciseProgress(area.id, i)?.completedAt) {
        return {
          title: seg.title,
          questionCount: seg.questions.length,
          afterVideo: videoNum > 0 ? videoNum : null,
          to: `${areaPath(area)}#exercise-${exerciseNum}`,
        };
      }
    }
  }
  return null;
}

interface HubStats {
  areasDone: number;
  areasTotal: number;
  exercisesDone: number;
  exercisesTotal: number;
  questionsAnswered: number;
}

function computeHubStats(registry: AreaRegistry, store: ProgressStore): HubStats {
  const areas = registry.areas.filter((a) => a.valid);
  let areasDone = 0;
  let exercisesDone = 0;
  let exercisesTotal = 0;
  let questionsAnswered = 0;
  for (const area of areas) {
    let exCount = 0;
    let doneCount = 0;
    area.segments.forEach((seg, i) => {
      if (seg.type !== "exercise") return;
      exCount += 1;
      const rec = store.getExerciseProgress(area.id, i);
      if (rec?.completedAt) doneCount += 1;
      if (rec) questionsAnswered += Object.keys(rec.questionOutcomes).length;
    });
    exercisesTotal += exCount;
    exercisesDone += doneCount;
    if (exCount > 0 && doneCount === exCount) areasDone += 1;
  }
  return { areasDone, areasTotal: areas.length, exercisesDone, exercisesTotal, questionsAnswered };
}

function RailUpNext() {
  const registry = useRegistry();
  const store = useProgressStore();
  const next = findUpNext(registry, store);
  return (
    <aside className="rail-card">
      <p className="section-label">Up next</p>
      {next ? (
        <Link className="up-next" to={next.to}>
          <StatusCircle variant="play-ring" size="md" label="Up next" />
          <span className="up-next__text">
            <span className="up-next__title">{next.title}</span>
            <span className="up-next__meta">
              {next.questionCount} question{next.questionCount === 1 ? "" : "s"}
              {next.afterVideo ? ` · after Video ${next.afterVideo}` : ""}
            </span>
          </span>
        </Link>
      ) : (
        <p className="rail-note">All caught up — nice work.</p>
      )}
    </aside>
  );
}

function RailProgress() {
  const registry = useRegistry();
  const store = useProgressStore();
  const s = computeHubStats(registry, store);
  return (
    <aside className="rail-card">
      <p className="section-label">Your progress</p>
      <dl className="stat-list">
        <StatRow label="Areas completed" value={`${s.areasDone}/${s.areasTotal}`} />
        <StatRow label="Exercises completed" value={`${s.exercisesDone}/${s.exercisesTotal}`} />
        <StatRow label="Questions answered" value={String(s.questionsAnswered)} />
      </dl>
    </aside>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-row">
      <dt className="stat-row__label">{label}</dt>
      <dd className="stat-row__val">{value}</dd>
    </div>
  );
}

function RailHowItWorks() {
  const steps = [
    "Watch the video.",
    "Work the exercise on paper.",
    "Tap the solution icon to check.",
  ];
  return (
    <aside className="rail-card">
      <p className="section-label">How it works</p>
      <ol className="howto">
        {steps.map((text, i) => (
          <li key={i} className="howto__step">
            <StatusCircle variant="number" size="sm" value={i + 1} label={`Step ${i + 1}`} />
            <span className="howto__text">{text}</span>
          </li>
        ))}
      </ol>
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
        {areas.map((area, i) => {
          const p = areaProgress(area, store);
          const kind = p.total > 0 && p.done === p.total ? "complete" : p.done > 0 ? "progress" : "idle";
          const label =
            kind === "complete" ? "Complete" : kind === "progress" ? `${p.done}/${p.total} done` : "Not started";
          const variant = kind === "complete" ? "check" : kind === "progress" ? "play-ring" : "number";
          return (
            <li key={area.id}>
              <Link className="topic-area-row" to={areaPath(area)}>
                <StatusCircle variant={variant} size="sm" value={i + 1} label={label} />
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
