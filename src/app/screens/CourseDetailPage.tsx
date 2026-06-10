/**
 * @file CourseDetailPage.tsx — /explore/:course (dashboard-register-v1 §Screens).
 *
 * 52px year badge + title + curriculum line, stat chips, a bordered topic list
 * (AVAILABLE chips; an empty course shows a single "being authored" SOON row),
 * then the CTA row: primary "Join [course]" + ghost "Back to explore" + the
 * joining note. Unknown course → not-found (never an error chip).
 */
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useRegistry } from "@/app/RegistryContext";
import { useProgressStore } from "@/state/ProgressContext";
import type { ProgressStore } from "@/state/progress";
import { titleCase } from "@/app/format";
import { courseStats, JoinButton } from "@/app/screens/ExplorePage";
import { NotFound } from "@/app/screens/NotFound";

function useStoreTick(store: ProgressStore): void {
  const [, setTick] = useState(0);
  useEffect(() => store.subscribe(() => setTick((t) => t + 1)), [store]);
}

export function CourseDetailPage() {
  const { course: courseId } = useParams();
  const registry = useRegistry();
  const store = useProgressStore();
  useStoreTick(store);

  const course = courseId ? registry.getCourseById(courseId) : undefined;
  if (!course) {
    return <NotFound message="That course doesn’t exist." />;
  }

  const stats = courseStats(registry, course.id);
  const topics = registry.getTopics(course.id);
  const authored = topics.length > 0;
  const curriculum = course.stream
    ? `Year ${course.year} · ${course.stream} · ${course.subject}`
    : `Year ${course.year} · ${course.subject}`;

  return (
    <>
      <header className="dash-detail__head">
        <span className="dash-badge dash-detail__badge" aria-hidden="true">
          {course.year}
        </span>
        <div>
          <h1 className="dash-greeting">{course.displayName}</h1>
          <p className="dash-explore__sub">{curriculum}</p>
        </div>
      </header>

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

      <section aria-label="Topics">
        <h2 className="dash-section__title">Topics</h2>
        <ul className="dash-list">
          {authored ? (
            topics.map((topic) => {
              const areas = registry.getAreasInTopic(course.id, topic).filter((a) => a.valid);
              return (
                <li key={topic} className="dash-list__row">
                  <span className="dash-badge dash-list__badge" aria-hidden="true">
                    {titleCase(topic).charAt(0)}
                  </span>
                  <span className="dash-list__text">
                    <span className="dash-list__name">{titleCase(topic)}</span>{" "}
                    <span className="dash-list__meta">
                      · {areas.length} area{areas.length === 1 ? "" : "s"}
                    </span>
                  </span>
                  <span className="dash-chip dash-chip--mint">Available</span>
                </li>
              );
            })
          ) : (
            <li className="dash-list__row">
              <span className="dash-badge dash-badge--grey dash-list__badge" aria-hidden="true">
                ·
              </span>
              <span className="dash-list__text">
                <span className="dash-list__name">Topics are being authored</span>
              </span>
              <span className="dash-chip dash-chip--soon">Soon</span>
            </li>
          )}
        </ul>
      </section>

      <div className="dash-detail__cta">
        <JoinButton courseId={course.id} label={`Join ${course.displayName}`} />
        <Link className="dash-btn dash-btn--ghost" to="/explore">
          Back to explore
        </Link>
        <p className="dash-detail__note">
          Joining adds it to your courses — progress tracked separately per course.
        </p>
      </div>
    </>
  );
}
