/**
 * @file CourseHub.tsx — /:course  (content-architecture-v1 §5)
 *
 * The home hub SCOPED to one course: greeting + the course displayName, a course
 * switcher (→ the picker), a continue/start hero, a topic grid, and the rail
 * (up-next / your-progress / how-it-works) — all computed over THIS course's
 * areas only, so progress is isolated per course. An empty course (no areas yet)
 * renders a calm "content coming soon" panel, never an error. Selecting the hub
 * remembers the course (localStorage). Reuses the v2 `.v2-home` skin.
 */
import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useRegistry } from "@/app/RegistryContext";
import { useProgressStore } from "@/state/ProgressContext";
import type { AreaRegistry, ValidatedArea } from "@/ingest/load";
import type { ProgressStore } from "@/state/progress";
import { titleCase, areaPath } from "@/app/format";
import { StatusCircle } from "@/shared/StatusCircle";
import { stagePath, exercisePath } from "@/app/stageProgress";
import { NotFound } from "@/app/screens/NotFound";

export function CourseHub() {
  const { course } = useParams();
  const registry = useRegistry();
  const store = useProgressStore();
  const courseId = course ?? "";
  const courseManifest = registry.getCourseById(courseId);

  // Remember the course selection whenever its hub is opened (§4).
  useEffect(() => {
    if (courseManifest) store.setSelectedCourse(courseId);
  }, [courseManifest, courseId, store]);

  if (!courseManifest) {
    return <NotFound message="That course doesn’t exist." />;
  }

  const topics = registry.getTopics(courseId);
  const empty = courseManifest.areaCount === 0 || topics.length === 0;

  return (
    <main className="app-page lib v2-home">
      <section className="lib-greeting">
        <p className="lib-kicker">{todayKicker()}</p>
        <h1 className="lib-headline">{courseManifest.displayName}</h1>
        <Link className="course-switch" to="/">
          <ArrowRight size={14} aria-hidden="true" style={{ transform: "rotate(180deg)" }} /> Switch
          course
        </Link>
      </section>

      {empty ? (
        <section className="area-section" aria-label="Course status">
          <div className="course-empty v2-panel">
            <div className="v2-panel__strip" aria-hidden="true" />
            <div className="v2-panel__body">
              <p className="course-empty__title">Content coming soon</p>
              <p className="course-empty__note">
                This course is set up — its lessons are being authored and will appear here.
              </p>
            </div>
          </div>
        </section>
      ) : (
        <div className="hub">
          <div className="hub__main">
            <Hero course={courseId} />
            <section className="area-section" aria-label="Topics">
              <p className="section-label">Topics</p>
              <div className="topic-grid">
                {topics.map((topic) => (
                  <TopicCard key={topic} course={courseId} topic={topic} />
                ))}
              </div>
            </section>
          </div>
          <aside className="hub__rail" aria-label="Hub sidebar">
            <RailUpNext course={courseId} />
            <RailProgress course={courseId} />
            <RailHowItWorks />
          </aside>
        </div>
      )}
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

/** Stage completion counts for an area. */
function areaProgress(area: ValidatedArea, store: ProgressStore): { done: number; total: number } {
  let done = 0;
  area.stages.forEach((_stage, i) => {
    if (store.getStageProgress(area.id, i)?.completedAt) done += 1;
  });
  return { done, total: area.stages.length };
}

/** 1-based number of the first not-yet-complete stage (null when all complete). */
function firstIncompleteStageNumber(area: ValidatedArea, store: ProgressStore): number | null {
  for (let i = 0; i < area.stages.length; i++) {
    if (!store.getStageProgress(area.id, i)?.completedAt) return i + 1;
  }
  return null;
}

/** Valid areas of one course, in topic → topic-area order. */
function courseAreas(registry: AreaRegistry, course: string): ValidatedArea[] {
  return registry
    .getTopics(course)
    .flatMap((topic) => registry.getAreasInTopic(course, topic))
    .filter((a) => a.valid);
}

function firstAreaOf(registry: AreaRegistry, course: string): ValidatedArea | undefined {
  return courseAreas(registry, course)[0];
}

function Hero({ course }: { course: string }) {
  const registry = useRegistry();
  const store = useProgressStore();
  const lastVisited = store.getLastVisited();
  const lastArea = lastVisited ? registry.getAreaById(lastVisited.areaId) : undefined;
  // Continue only within THIS course; otherwise "start here" at its first area.
  const resume = lastArea?.valid && lastArea.course === course ? lastArea : undefined;
  const target = resume ?? firstAreaOf(registry, course);
  if (!target) return null;

  const kicker = resume ? "Continue where you left off" : "Start here";
  let to: string;
  if (resume && lastVisited) {
    const sn = Math.min(Math.max(lastVisited.stageIndex, 0), target.stages.length - 1) + 1;
    to = lastVisited.view === "exercise" ? exercisePath(target, sn) : stagePath(target, sn);
  } else {
    to = stagePath(target, firstIncompleteStageNumber(target, store) ?? 1);
  }
  return (
    <Link className="hero" to={to}>
      <span className="hero__text">
        <span className="hero__kicker">{kicker}</span>
        <span className="hero__title">{target.title}</span>
        <span className="hero__crumb">
          {titleCase(target.topic)} · {titleCase(target.topicArea)}
        </span>
      </span>
      <span className="hero__cta" aria-hidden="true">
        Open <ArrowRight size={16} />
      </span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Rail (hub sidebar) — flat informational cards, scoped to the course.
// ---------------------------------------------------------------------------

interface UpNext {
  title: string;
  questionCount: number;
  to: string;
}

/** First incomplete stage within the course, in order (null if all done). */
function findUpNext(registry: AreaRegistry, store: ProgressStore, course: string): UpNext | null {
  for (const area of courseAreas(registry, course)) {
    for (let i = 0; i < area.stages.length; i++) {
      if (!store.getStageProgress(area.id, i)?.completedAt) {
        const stage = area.stages[i]!;
        return {
          title: stage.title,
          questionCount: stage.exercise.questions.length,
          to: stagePath(area, i + 1),
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

function computeHubStats(registry: AreaRegistry, store: ProgressStore, course: string): HubStats {
  const areas = courseAreas(registry, course);
  let areasDone = 0;
  let exercisesDone = 0;
  let exercisesTotal = 0;
  let questionsAnswered = 0;
  for (const area of areas) {
    let exCount = 0;
    let doneCount = 0;
    area.stages.forEach((_stage, i) => {
      exCount += 1;
      const rec = store.getStageProgress(area.id, i);
      if (rec?.completedAt) doneCount += 1;
      if (rec) {
        questionsAnswered += Object.keys(rec.core).length + Object.keys(rec.extra).length;
      }
    });
    exercisesTotal += exCount;
    exercisesDone += doneCount;
    if (exCount > 0 && doneCount === exCount) areasDone += 1;
  }
  return { areasDone, areasTotal: areas.length, exercisesDone, exercisesTotal, questionsAnswered };
}

function RailUpNext({ course }: { course: string }) {
  const registry = useRegistry();
  const store = useProgressStore();
  const next = findUpNext(registry, store, course);
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
            </span>
          </span>
        </Link>
      ) : (
        <p className="rail-note">All caught up — nice work.</p>
      )}
    </aside>
  );
}

function RailProgress({ course }: { course: string }) {
  const registry = useRegistry();
  const store = useProgressStore();
  const s = computeHubStats(registry, store, course);
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
    "Type your answer and check it.",
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

function TopicCard({ course, topic }: { course: string; topic: string }) {
  const registry = useRegistry();
  const store = useProgressStore();
  const areas = registry.getAreasInTopic(course, topic).filter((a) => a.valid);
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
