/**
 * @file CoursePicker.tsx — the course landing at `/` (content-architecture-v1 §5).
 *
 * "Pick your course": v2 course cards on the grid canvas (white panel + mint
 * strip, mint accent), sorted by `order`. Each card shows the course displayName,
 * a year·stream meta, and a mastery % across the course's areas. An empty course
 * (areaCount === 0) renders a calm "content coming soon" card — never an error,
 * never clickable. Selecting a course remembers it (localStorage) and routes into
 * the course hub. Reuses the v2 tokens/panels/mint-strip only.
 */
import { Link } from "react-router-dom";
import { useRegistry } from "@/app/RegistryContext";
import { useProgressStore } from "@/state/ProgressContext";
import type { AreaRegistry, ValidatedCourse } from "@/ingest/load";
import type { ProgressStore } from "@/state/progress";

/** Mastery % for a course = completed stages / total stages across its areas. */
function courseMasteryPct(registry: AreaRegistry, store: ProgressStore, courseId: string): number {
  let done = 0;
  let total = 0;
  for (const area of registry.areas) {
    if (!area.valid || area.course !== courseId) continue;
    for (let i = 0; i < area.stages.length; i++) {
      total += 1;
      if (store.getStageProgress(area.id, i)?.completedAt) done += 1;
    }
  }
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

function courseMeta(c: ValidatedCourse): string {
  return c.stream ? `Year ${c.year} · ${c.stream}` : `Year ${c.year}`;
}

export function CoursePicker() {
  const registry = useRegistry();
  const courses = registry.getCourses();

  return (
    <main className="app-page lib v2-home">
      <section className="lib-greeting">
        <p className="lib-kicker">Courses</p>
        <h1 className="lib-headline">Pick your course</h1>
      </section>

      <ul className="course-grid" aria-label="Courses">
        {courses.map((c) => (
          <CourseCard key={c.id} course={c} />
        ))}
      </ul>
    </main>
  );
}

function CourseCard({ course }: { course: ValidatedCourse }) {
  const registry = useRegistry();
  const store = useProgressStore();
  const empty = course.areaCount === 0;

  if (empty) {
    return (
      <li className="course-card course-card--soon" aria-disabled="true">
        <p className="course-card__name">{course.displayName}</p>
        <p className="course-card__meta v2-mono">{courseMeta(course)}</p>
        <p className="course-card__soon">Content coming soon</p>
      </li>
    );
  }

  const pct = courseMasteryPct(registry, store, course.id);
  return (
    <li className="course-card">
      <Link
        className="course-card__link"
        to={`/${course.id}`}
        onClick={() => store.setSelectedCourse(course.id)}
      >
        <p className="course-card__name">{course.displayName}</p>
        <p className="course-card__meta v2-mono">{courseMeta(course)}</p>
        <div className="course-card__progress" aria-hidden="true">
          <div className="course-card__progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <p className="course-card__pct">
          <span className="course-card__pct-val">{pct}%</span> mastery
        </p>
      </Link>
    </li>
  );
}
