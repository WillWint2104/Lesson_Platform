/**
 * @file ContentsSidebar.tsx — the v2 primary nav (design-language-v2 §4).
 *
 * A 288px white sidebar: unit title + a progress bar, then one group per stage
 * (`N · TITLE`, a non-link mono label) each listing a **Video** and an
 * **Exercise** item. Each item is a link with a status circle (§4) and a meta
 * (`6 min` / `4 Q`). The item matching the active route is highlighted
 * (mint-tint + inset mint edge + bold).
 *
 * Status: we track stage completion (exercise done), not video-watched, so both
 * items of a stage share that stage's status (done / current / upcoming) from
 * the shared unlock derivation. The stage TITLE is rendered as a label, never a
 * link, so it never collides with the in-page stepper's stage links.
 */
import { Link } from "react-router-dom";
import type { ValidatedArea } from "@/ingest/load";
import type { ProgressStore } from "@/state/progress";
import { computeStageStatus, isAreaComplete, type StageStatus } from "@/app/unlock";
import { stageInputs, stagePath, exercisePath } from "@/app/stageProgress";
import { titleCase } from "@/app/format";
import { CheckIcon } from "@/shared/v2/icons";
import type { AreaView } from "@/app/routeArea";

export interface ContentsSidebarProps {
  area: ValidatedArea;
  store: ProgressStore;
  /** Active stage (1-based) + view, when the route points at a stage. */
  activeStage?: number;
  activeView?: AreaView;
}

function StatusDot({ status, label }: { status: StageStatus; label: string }) {
  return (
    <span className={`cs-status cs-status--${status}`} role="img" aria-label={label}>
      {status === "done" ? <CheckIcon size={12} /> : null}
    </span>
  );
}

export function ContentsSidebar({ area, store, activeStage, activeView }: ContentsSidebarProps) {
  const inputs = stageInputs(area, store);
  const statuses = computeStageStatus(inputs);
  const doneCount = inputs.filter((s) => s.complete).length;
  const total = area.stages.length;
  const pct = total === 0 ? 0 : Math.round((doneCount / total) * 100);
  const complete = isAreaComplete(inputs);

  return (
    <nav className="contents-sidebar" aria-label="Lesson contents">
      <div className="cs-head">
        <p className="cs-unit-kicker v2-mono">Unit</p>
        <h2 className="cs-unit-title">{area.title}</h2>
        <div
          className="cs-progress"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Unit progress: ${pct}% complete`}
        >
          <span className="cs-progress__fill" style={{ width: `${pct}%` }} />
        </div>
        <p className="cs-progress__meta">
          {complete ? "Complete" : `${doneCount} of ${total} stages`}
        </p>
      </div>

      <ol className="cs-stages">
        {area.stages.map((stage, i) => {
          const n = i + 1;
          const status = statuses[i]!;
          const videoActive = activeStage === n && activeView !== "exercise";
          const exerciseActive = activeStage === n && activeView === "exercise";
          const statusLabel =
            status === "done" ? "completed" : status === "current" ? "in progress" : "not started";
          const durMeta =
            stage.video && typeof stage.video.duration === "number"
              ? `${stage.video.duration} min`
              : "watch";
          const qCount = stage.exercise.questions.length;
          return (
            <li key={i} className="cs-stage">
              <p className="cs-stage__label v2-mono">
                <span className="cs-stage__num">{n}</span> {titleCase(stage.title)}
              </p>
              <Link
                to={stagePath(area, n)}
                className={`cs-item${videoActive ? " cs-item--active" : ""}`}
                aria-label={`Stage ${n} video`}
                aria-current={videoActive ? "page" : undefined}
              >
                <StatusDot status={status} label={statusLabel} />
                <span className="cs-item__label">Video</span>
                <span className="cs-item__meta">{durMeta}</span>
              </Link>
              <Link
                to={exercisePath(area, n)}
                className={`cs-item${exerciseActive ? " cs-item--active" : ""}`}
                aria-label={`Stage ${n} exercise`}
                aria-current={exerciseActive ? "page" : undefined}
              >
                <StatusDot status={status} label={statusLabel} />
                <span className="cs-item__label">Exercise</span>
                <span className="cs-item__meta">
                  {qCount} Q
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
