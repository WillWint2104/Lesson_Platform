/**
 * @file Onboarding.tsx — first-visit welcome (dashboard-register-v1 §Screens).
 *
 * Shown at `/` when there are no joined courses and no remembered course: a
 * single centered welcome card — mint tile, title, one descriptive line, a year
 * grid 7–12 (years with AUTHORED courses selectable; unauthored/unregistered
 * years disabled with SOON), one primary "Start with [selection]" button, and
 * the local-progress footnote. Choosing a year joins that course and lands on
 * its dashboard. Becomes the real signup flow when accounts land.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRegistry } from "@/app/RegistryContext";
import { useProgressStore } from "@/state/ProgressContext";

export function Onboarding() {
  const registry = useRegistry();
  const store = useProgressStore();
  const navigate = useNavigate();

  // One course per year today; selectable = a registered course WITH content.
  const courses = registry.getCourses();
  const byYear = new Map(courses.map((c) => [c.year, c] as const));
  const selectable = courses.filter((c) => c.areaCount > 0);
  const [picked, setPicked] = useState<string | null>(selectable[0]?.id ?? null);
  const pickedCourse = picked ? registry.getCourseById(picked) : undefined;

  function start() {
    if (!pickedCourse) return;
    store.setSelectedCourse(pickedCourse.id); // selecting implies enrolment (auto-join)
    navigate(`/${pickedCourse.id}`);
  }

  return (
    <div className="dash-welcome">
      <div className="dash-welcome__card">
        <span className="dash-brand__tile dash-welcome__tile" aria-hidden="true">
          LP
        </span>
        <h1 className="dash-greeting">Welcome to Lesson Platform</h1>
        <p className="dash-welcome__sub">
          Pick your year level to set up your dashboard — you can add more courses any time.
        </p>

        <div className="dash-welcome__years" role="group" aria-label="Choose your year">
          {[7, 8, 9, 10, 11, 12].map((year) => {
            const course = byYear.get(year);
            const available = !!course && course.areaCount > 0;
            const selected = available && picked === course.id;
            return (
              <button
                key={year}
                type="button"
                className={`dash-year${selected ? " dash-year--selected" : ""}`}
                disabled={!available}
                aria-pressed={available ? selected : undefined}
                onClick={() => available && setPicked(course.id)}
              >
                <span className="dash-year__num">Year {year}</span>
                {available ? (
                  <span className="dash-year__name">{course.displayName}</span>
                ) : (
                  <span className="dash-chip dash-chip--soon">Soon</span>
                )}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className="dash-btn dash-btn--primary dash-welcome__start"
          disabled={!pickedCourse}
          onClick={start}
        >
          Start with {pickedCourse ? pickedCourse.displayName : "…"}
        </button>
        <p className="dash-welcome__foot">Your progress is saved in this browser on this device.</p>
      </div>
    </div>
  );
}
