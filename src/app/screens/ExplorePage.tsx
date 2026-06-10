/**
 * @file ExplorePage.tsx — /explore (dashboard-register-v1 §Screens).
 *
 * Title + sub, filter pills (All / Junior 7–10 / Senior 11–12), then courses
 * grouped Senior/Junior as cards: year badge, name, stream meta, stat chips
 * (N TOPICS, N QUESTIONS when authored; CONTENT GROWING when registered-but-
 * empty), and a Join control ("+ Join course" → "✓ Added" + JOINED chip).
 * Scaffolded-but-empty courses are joinable; purely-future years (7–12 with no
 * registered course) render as dashed soon-cards (COMING SOON) without a join
 * button. Cards link to /explore/:course for the detail view.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useRegistry } from "@/app/RegistryContext";
import { useProgressStore } from "@/state/ProgressContext";
import type { AreaRegistry, ValidatedCourse } from "@/ingest/load";
import type { ProgressStore } from "@/state/progress";

function useStoreTick(store: ProgressStore): void {
  const [, setTick] = useState(0);
  useEffect(() => store.subscribe(() => setTick((t) => t + 1)), [store]);
}

type Filter = "all" | "junior" | "senior";
const isSenior = (year: number) => year >= 11;

/** Topic + question counts for a course's authored content. */
export function courseStats(
  registry: AreaRegistry,
  courseId: string,
): { topics: number; questions: number } {
  const topics = registry.getTopics(courseId).length;
  let questions = 0;
  for (const area of registry.areas) {
    if (!area.valid || area.course !== courseId) continue;
    for (const s of area.stages) questions += s.exercise.questions.length + s.exercise.extra.length;
  }
  return { topics, questions };
}

/** Years 7–12 with no registered course → dashed COMING SOON placeholders. */
function futureYears(courses: ValidatedCourse[]): number[] {
  const covered = new Set(courses.map((c) => c.year));
  return [7, 8, 9, 10, 11, 12].filter((y) => !covered.has(y));
}

export function ExplorePage() {
  const registry = useRegistry();
  const store = useProgressStore();
  useStoreTick(store);
  const [filter, setFilter] = useState<Filter>("all");

  const courses = registry.getCourses();
  const matches = (year: number) =>
    filter === "all" || (filter === "senior" ? isSenior(year) : !isSenior(year));

  const senior = courses.filter((c) => isSenior(c.year) && matches(c.year));
  const junior = courses.filter((c) => !isSenior(c.year) && matches(c.year));
  const future = futureYears(courses).filter((y) => matches(y));

  return (
    <>
      <header>
        <h1 className="dash-greeting">Explore courses</h1>
        <p className="dash-explore__sub">
          Browse the course library and add courses to your dashboard. Progress is tracked
          separately per course.
        </p>
      </header>

      <div className="dash-pills" role="group" aria-label="Filter courses">
        {(
          [
            ["all", "All"],
            ["junior", "Junior 7–10"],
            ["senior", "Senior 11–12"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`dash-pill${filter === value ? " dash-pill--active" : ""}`}
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {senior.length > 0 || future.some(isSenior) ? (
        <ExploreGroup
          label="Senior"
          courses={senior}
          futureYears={future.filter((y) => isSenior(y))}
        />
      ) : null}
      {junior.length > 0 || future.some((y) => !isSenior(y)) ? (
        <ExploreGroup
          label="Junior"
          courses={junior}
          futureYears={future.filter((y) => !isSenior(y))}
        />
      ) : null}
    </>
  );
}

function ExploreGroup({
  label,
  courses,
  futureYears,
}: {
  label: string;
  courses: ValidatedCourse[];
  futureYears: number[];
}) {
  return (
    <section aria-label={`${label} courses`}>
      <h2 className="dash-section__title">{label}</h2>
      <ul className="dash-grid">
        {courses.map((c) => (
          <ExploreCard key={c.id} course={c} />
        ))}
        {futureYears.map((y) => (
          <li key={y} className="dash-card dash-card--soon">
            <div className="dash-card__head">
              <span className="dash-badge dash-badge--grey dash-card__badge" aria-hidden="true">
                {y}
              </span>
              <div>
                <p className="dash-card__name">Year {y} · Mathematics</p>
                <p className="dash-card__meta">Year {y}</p>
              </div>
            </div>
            <div>
              <span className="dash-chip dash-chip--soon">Coming soon</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ExploreCard({ course }: { course: ValidatedCourse }) {
  const registry = useRegistry();
  const store = useProgressStore();
  const joined = store.isJoined(course.id);
  const authored = course.areaCount > 0;
  const stats = courseStats(registry, course.id);
  const meta = course.stream ? `Year ${course.year} · ${course.stream}` : `Year ${course.year}`;

  return (
    <li className="dash-card">
      <div className="dash-card__head">
        <span className="dash-badge dash-card__badge" aria-hidden="true">
          {course.year}
        </span>
        <div>
          <p className="dash-card__name">
            <Link className="dash-card__namelink" to={`/explore/${course.id}`}>
              {course.displayName}
            </Link>
          </p>
          <p className="dash-card__meta">{meta}</p>
        </div>
        {joined ? (
          <span className="dash-chip dash-chip--mint" style={{ marginLeft: "auto" }}>
            Joined
          </span>
        ) : null}
      </div>

      <div className="dash-stats">
        {authored ? (
          <>
            <span className="dash-chip dash-chip--soon">
              {stats.topics} topic{stats.topics === 1 ? "" : "s"}
            </span>
            <span className="dash-chip dash-chip--soon">
              {stats.questions} question{stats.questions === 1 ? "" : "s"}
            </span>
          </>
        ) : (
          <span className="dash-chip dash-chip--soon">Content growing</span>
        )}
      </div>

      <JoinButton courseId={course.id} />
    </li>
  );
}

/** "+ Join course" → "✓ Added" (joined). Shared by explore + course detail. */
export function JoinButton({ courseId, label }: { courseId: string; label?: string }) {
  const store = useProgressStore();
  const joined = store.isJoined(courseId);
  if (joined) {
    return (
      <button type="button" className="dash-btn dash-btn--ghost dash-btn--added" disabled>
        ✓ Added
      </button>
    );
  }
  return (
    <button
      type="button"
      className="dash-btn dash-btn--primary"
      onClick={() => store.joinCourse(courseId)}
    >
      + {label ?? "Join course"}
    </button>
  );
}
