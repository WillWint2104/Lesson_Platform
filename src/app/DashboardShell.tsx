/**
 * @file DashboardShell.tsx — layout for DASHBOARD-register routes
 * (docs/dashboard-register-v1.md).
 *
 * 248px white sidebar (brand tile + wordmark; Home / Explore courses / Progress
 * nav; YOUR COURSES with a % or "soon" chip per joined course; footer avatar +
 * "Local progress") beside a 980px-max main column. Tokens are the shared family
 * re-scoped to dashboard values under `.dash-root` — NO grid texture, NO mint
 * strips here. Lesson/stage/exercise routes stay under the lesson AppShell.
 *
 * "Explore courses" is rendered but disabled (SOON) until PR-D3 ships the
 * /explore screens; "Progress" has no specced screen yet → disabled (SOON).
 * Icons are inline SVG (never emoji).
 */
import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useRegistry } from "@/app/RegistryContext";
import { useProgressStore } from "@/state/ProgressContext";
import type { ProgressStore } from "@/state/progress";
import type { AreaRegistry } from "@/ingest/load";

function useStoreTick(store: ProgressStore): void {
  const [, setTick] = useState(0);
  useEffect(() => store.subscribe(() => setTick((t) => t + 1)), [store]);
}

/** Course mastery % = completed stages / total stages across its areas. */
export function courseMasteryPct(
  registry: AreaRegistry,
  store: ProgressStore,
  courseId: string,
): number {
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

/* ---- Inline SVG icons (dashboard set; 1.5 stroke, currentColor) ---------- */
function Icon({ d, size = 16 }: { d: ReactNode; size?: number }) {
  return (
    <svg
      className="dash-nav__icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {d}
    </svg>
  );
}
const HomeIcon = () => (
  <Icon d={<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1Z" />} />
);
const ExploreIcon = () => (
  <Icon
    d={
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m15.5 8.5-2 5-5 2 2-5Z" />
      </>
    }
  />
);
const ProgressIcon = () => (
  <Icon
    d={
      <>
        <path d="M4 20V10" />
        <path d="M10 20V4" />
        <path d="M16 20v-7" />
        <path d="M22 20H2" />
      </>
    }
  />
);

export function DashboardShell() {
  const registry = useRegistry();
  const store = useProgressStore();
  const { pathname } = useLocation();
  useStoreTick(store);

  const joined = store.getJoinedCourses();
  const current = store.getSelectedCourse();

  return (
    <div className="dash-root">
      <aside className="dash-sidebar">
        <Link className="dash-brand" to="/">
          <span className="dash-brand__tile" aria-hidden="true">
            LP
          </span>
          <span className="dash-brand__word">Lesson Platform</span>
        </Link>

        <nav className="dash-nav" aria-label="Dashboard">
          <Link
            className={`dash-nav__item${pathname === "/" ? " dash-nav__item--active" : ""}`}
            to="/"
            aria-current={pathname === "/" ? "page" : undefined}
          >
            <HomeIcon /> Home
          </Link>
          {/* Enabled in PR-D3 when /explore ships. */}
          <span className="dash-nav__item dash-nav__item--soon" aria-disabled="true">
            <ExploreIcon /> Explore courses <span className="dash-chip dash-chip--soon">Soon</span>
          </span>
          {/* No Progress screen specced yet — disabled slot per the soon rule. */}
          <span className="dash-nav__item dash-nav__item--soon" aria-disabled="true">
            <ProgressIcon /> Progress <span className="dash-chip dash-chip--soon">Soon</span>
          </span>
        </nav>

        <div>
          <p className="dash-group__label">Your courses</p>
          <nav aria-label="Your courses">
            {joined.map((id) => {
              const course = registry.getCourseById(id);
              if (!course) return null;
              const pct = courseMasteryPct(registry, store, id);
              const active = current === id && (pathname === "/" || pathname === `/${id}`);
              return (
                <Link
                  key={id}
                  className={`dash-course-item${active ? " dash-course-item--active" : ""}`}
                  to={`/${id}`}
                  aria-current={active ? "page" : undefined}
                >
                  <span className="dash-course-item__name">{course.displayName}</span>
                  {course.areaCount === 0 ? (
                    <span className="dash-chip dash-chip--soon">Soon</span>
                  ) : (
                    <span className="dash-chip dash-chip--mint">{pct}%</span>
                  )}
                </Link>
              );
            })}
            {joined.length === 0 ? (
              <p className="dash-sidefoot__note" style={{ padding: "0 10px" }}>
                No courses yet
              </p>
            ) : null}
          </nav>
        </div>

        <div className="dash-sidefoot">
          <span className="dash-avatar" aria-label="Profile (placeholder)">
            LP
          </span>
          <span className="dash-sidefoot__note">Local progress</span>
        </div>
      </aside>

      <main className="dash-main">
        <div className="dash-main__inner">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
