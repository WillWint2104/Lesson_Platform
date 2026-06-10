/**
 * @file DashboardHome.tsx — HOME/DASHBOARD (docs/dashboard-register-v1.md).
 *
 * `/` renders the home for the CURRENT course; `/:course` opens that course's
 * home (and makes it current — selecting implies enrolment). Anatomy: greeting
 * (small date + "Welcome back") → CONTINUE card (the one focal element) →
 * "[Course] — Topics" bordered list (rows: mint badge, name, meta, status chip,
 * chevron) → "All courses" card grid (joined/authored cards link; unauthored =
 * dashed SOON cards). An empty current course shows a calm "content coming"
 * card — never an error. First visits never reach this screen (HomeGate routes
 * them to onboarding); with no remembered course it falls back to the first
 * joined course, then the first by `order`.
 */
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { ReactNode } from "react";
import { useRegistry } from "@/app/RegistryContext";
import { useProgressStore } from "@/state/ProgressContext";
import type { AreaRegistry, ValidatedArea, ValidatedCourse } from "@/ingest/load";
import type { ProgressStore } from "@/state/progress";
import { titleCase, areaPath } from "@/app/format";
import { stagePath, exercisePath } from "@/app/stageProgress";
import { courseMasteryPct } from "@/app/DashboardShell";
import { NotFound } from "@/app/screens/NotFound";

function useStoreTick(store: ProgressStore): void {
  const [, setTick] = useState(0);
  useEffect(() => store.subscribe(() => setTick((t) => t + 1)), [store]);
}

function todayLabel(): string {
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

/** Valid areas of one course, in topic → topic-area order. */
function courseAreas(registry: AreaRegistry, course: string): ValidatedArea[] {
  return registry
    .getTopics(course)
    .flatMap((topic) => registry.getAreasInTopic(course, topic))
    .filter((a) => a.valid);
}

function areaProgress(area: ValidatedArea, store: ProgressStore): { done: number; total: number } {
  let done = 0;
  area.stages.forEach((_s, i) => {
    if (store.getStageProgress(area.id, i)?.completedAt) done += 1;
  });
  return { done, total: area.stages.length };
}

function firstIncompleteStageNumber(area: ValidatedArea, store: ProgressStore): number | null {
  for (let i = 0; i < area.stages.length; i++) {
    if (!store.getStageProgress(area.id, i)?.completedAt) return i + 1;
  }
  return null;
}

const PlaySvg = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="none"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M8 5.5v13l11-6.5Z" />
  </svg>
);
const ChevronSvg = () => (
  <svg
    className="dash-list__chevron"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d="m9 6 6 6-6 6" />
  </svg>
);

export function DashboardHome() {
  const { course: courseParam } = useParams();
  const registry = useRegistry();
  const store = useProgressStore();
  useStoreTick(store);

  // Which course is this home for? Route param wins; else the remembered
  // course; else the first joined course; else first by order (first-visit
  // lands on onboarding via HomeGate before this can apply).
  const fallback =
    store.getJoinedCourses()[0] ?? registry.getCourses()[0]?.id ?? null;
  const courseId = courseParam ?? store.getSelectedCourse() ?? fallback;
  const course = courseId ? registry.getCourseById(courseId) : undefined;

  // Opening a course's home makes it current (selecting implies enrolment).
  useEffect(() => {
    if (course && store.getSelectedCourse() !== course.id) store.setSelectedCourse(course.id);
  }, [course, store]);

  if (!course) {
    return <NotFound message="That course doesn’t exist." />;
  }

  const topics = registry.getTopics(course.id);
  const empty = course.areaCount === 0 || topics.length === 0;

  return (
    <>
      <header>
        <p className="dash-date">{todayLabel()}</p>
        <h1 className="dash-greeting">Welcome back</h1>
      </header>

      {!empty ? <ContinueCard course={course.id} /> : null}

      <section aria-label={`${course.displayName} topics`}>
        <h2 className="dash-section__title">{course.displayName} — Topics</h2>
        {empty ? (
          <div className="dash-empty">
            <p className="dash-empty__title">Content coming soon</p>
            <p className="dash-empty__note">
              This course is set up — its lessons are being authored and will appear here.
            </p>
          </div>
        ) : (
          <ul className="dash-list">
            {topics.map((topic) => (
              <TopicRow key={topic} course={course.id} topic={topic} />
            ))}
          </ul>
        )}
      </section>

      <section aria-label="All courses">
        <h2 className="dash-section__title">All courses</h2>
        <ul className="dash-grid">
          {registry.getCourses().map((c) => (
            <CourseCard key={c.id} course={c} />
          ))}
        </ul>
      </section>
    </>
  );
}

/** The one focal element: resume within the current course. */
function ContinueCard({ course }: { course: string }) {
  const registry = useRegistry();
  const store = useProgressStore();
  const lastVisited = store.getLastVisited();
  const lastArea = lastVisited ? registry.getAreaById(lastVisited.areaId) : undefined;
  const resume = lastArea?.valid && lastArea.course === course ? lastArea : undefined;
  const target = resume ?? courseAreas(registry, course)[0];
  if (!target) return null;

  let to: string;
  let stageNo: number;
  if (resume && lastVisited) {
    stageNo = Math.min(Math.max(lastVisited.stageIndex, 0), target.stages.length - 1) + 1;
    to = lastVisited.view === "exercise" ? exercisePath(target, stageNo) : stagePath(target, stageNo);
  } else {
    stageNo = firstIncompleteStageNumber(target, store) ?? 1;
    to = stagePath(target, stageNo);
  }
  const stage = target.stages[stageNo - 1];

  return (
    <section className="dash-continue" aria-label="Continue learning">
      <span className="dash-continue__tile" aria-hidden="true">
        <PlaySvg />
      </span>
      <div className="dash-continue__text">
        <p className="dash-continue__kicker">Continue</p>
        <p className="dash-continue__title">{target.title}</p>
        <p className="dash-continue__sub">
          {titleCase(target.topic)} · Stage {stageNo}
          {stage ? ` — ${titleCase(stage.title)}` : ""}
        </p>
      </div>
      <Link className="dash-btn dash-btn--primary" to={to}>
        Continue
      </Link>
    </section>
  );
}

function TopicRow({ course, topic }: { course: string; topic: string }) {
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
  const started = totals.done > 0;
  // Row target: the first not-yet-complete area of the topic (else the first).
  const target =
    areas.find((a) => areaProgress(a, store).done < areaProgress(a, store).total) ?? areas[0];
  if (!target) return null;

  let chip: ReactNode;
  if (totals.total > 0 && totals.done === totals.total) {
    chip = <span className="dash-chip dash-chip--mint">Complete</span>;
  } else if (started) {
    chip = <span className="dash-chip dash-chip--mint">In progress · {pct}%</span>;
  } else {
    chip = <span className="dash-chip dash-chip--soon">Not started</span>;
  }

  return (
    <li>
      <Link className="dash-list__row" to={areaPath(target)}>
        <span className="dash-badge dash-list__badge" aria-hidden="true">
          {titleCase(topic).charAt(0)}
        </span>
        <span className="dash-list__text">
          <span className="dash-list__name">{titleCase(topic)}</span>{" "}
          <span className="dash-list__meta">
            · {areas.length} area{areas.length === 1 ? "" : "s"}
          </span>
        </span>
        {chip}
        <ChevronSvg />
      </Link>
    </li>
  );
}

function CourseCard({ course }: { course: ValidatedCourse }) {
  const registry = useRegistry();
  const store = useProgressStore();
  const authored = course.areaCount > 0;
  const pct = courseMasteryPct(registry, store, course.id);
  const meta = course.stream ? `Year ${course.year} · ${course.stream}` : `Year ${course.year}`;

  if (!authored) {
    // Unauthored: dashed, grey badge, SOON chip — not a link (nothing to open yet).
    return (
      <li className="dash-card dash-card--soon">
        <div className="dash-card__head">
          <span className="dash-badge dash-badge--grey dash-card__badge" aria-hidden="true">
            {course.year}
          </span>
          <div>
            <p className="dash-card__name">{course.displayName}</p>
            <p className="dash-card__meta">{meta}</p>
          </div>
          <span className="dash-chip dash-chip--soon" style={{ marginLeft: "auto" }}>
            Soon
          </span>
        </div>
      </li>
    );
  }

  return (
    <li>
      <Link className="dash-card" to={`/${course.id}`}>
        <div className="dash-card__head">
          <span className="dash-badge dash-card__badge" aria-hidden="true">
            {course.year}
          </span>
          <div>
            <p className="dash-card__name">{course.displayName}</p>
            <p className="dash-card__meta">{meta}</p>
          </div>
          <span className="dash-card__pct">{pct}%</span>
        </div>
        <div className="dash-progress" aria-hidden="true">
          <div className="dash-progress__fill" style={{ width: `${pct}%` }} />
        </div>
      </Link>
    </li>
  );
}
