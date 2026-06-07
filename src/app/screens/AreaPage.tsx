/**
 * @file AreaPage.tsx — one page per topic area (/:subject/:topic/:topicArea).
 *
 * v3 STAGE model: an area is a sequence of stages (one skill each = notes →
 * video → exercise, with an optional extra-practice pool). Nothing locks —
 * navigation is free (Mayer segmenting); each stage shows a derived status
 * (done / current / upcoming).
 *
 * Completion: a stage completes when every CORE question has an outcome (ANY
 * outcome — never gated on correctness). Extra outcomes never affect completion.
 * `completedAt` is sticky; review re-runs record fresh outcomes + attempts.
 *
 * NOTE: the full page-by-page STEPPER UX is a follow-up; this renders the stages
 * linearly with their status motif. (QuestionRunner remains dormant.)
 */
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { Check } from "lucide-react";
import { useRegistry } from "@/app/RegistryContext";
import { useProgressStore } from "@/state/ProgressContext";
import type { ProgressStore, StageRecord } from "@/state/progress";
import type { ResolvedStage } from "@/ingest/load";
import { computeStageStatus, currentStageIndex, isAreaComplete, type StageStatus } from "@/app/unlock";
import { titleCase } from "@/app/format";
import { VideoEmbed } from "@/render/VideoEmbed";
import { NotesRenderer } from "@/render/notes/NotesRenderer";
import { Worksheet } from "@/render/questions/Worksheet";
import type { Outcome } from "@/render/questions/types";
import { StatusCircle } from "@/shared/StatusCircle";
import { NotFound } from "@/app/screens/NotFound";

/** Subscribe to the store and force a re-render whenever progress changes. */
function useStoreTick(store: ProgressStore): void {
  const [, setTick] = useState(0);
  useEffect(() => store.subscribe(() => setTick((t) => t + 1)), [store]);
}

const stageAnchor = (n: number) => `stage-${n}`;

/** Whether every core question in a stage has an outcome (the completion rule). */
function allCoreAnswered(rec: StageRecord | null, coreCount: number): boolean {
  if (coreCount === 0) return false;
  for (let k = 0; k < coreCount; k++) if (rec?.core[k] === undefined) return false;
  return true;
}

function stageVariant(status: StageStatus): "check" | "play-ring" | "number" {
  return status === "done" ? "check" : status === "current" ? "play-ring" : "number";
}
function stageStatusLabel(status: StageStatus): string {
  return status === "done" ? "Complete" : status === "current" ? "Current" : "Upcoming";
}

export function AreaPage() {
  const { subject, topic, topicArea } = useParams();
  const registry = useRegistry();
  const store = useProgressStore();
  const location = useLocation();
  const areaId = `${subject}/${topic}/${topicArea}`;
  const area = registry.getAreaById(areaId);
  const ok = !!area && area.valid;

  useStoreTick(store);

  // Per-stage completion (all core answered), derived from the store.
  const stageInputs = (area?.stages ?? []).map((stage, i) => ({
    complete: allCoreAnswered(
      store.getStageProgress(areaId, i),
      stage.exercise.questions.length,
    ),
  }));

  useEffect(() => {
    if (ok && area) store.setLastVisited(area.id, currentStageIndex(stageInputs), "stage");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ok, area, store]);

  // Deep-link: scroll to the anchored stage (hero "continue" target) on load.
  const scrolledHash = useRef<string | null>(null);
  useEffect(() => {
    const hash = location.hash.replace(/^#/, "");
    if (!ok || !hash || scrolledHash.current === hash) return;
    const el = document.getElementById(hash);
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      scrolledHash.current = hash;
    }
  }, [ok, location.hash]);

  if (!ok || !area) {
    return <NotFound message="That topic area doesn’t exist." />;
  }

  const statuses = computeStageStatus(stageInputs);
  const complete = isAreaComplete(stageInputs);
  const questionTotal = area.stages.reduce((sum, s) => sum + s.exercise.questions.length, 0);

  /** Record a core outcome; set the sticky completedAt when all core are answered. */
  function recordCore(stageIndex: number, qIndex: number, outcome: Outcome, coreCount: number) {
    const before = allCoreAnswered(store.getStageProgress(area!.id, stageIndex), coreCount);
    store.recordOutcome(area!.id, stageIndex, "core", qIndex, outcome);
    const after = allCoreAnswered(store.getStageProgress(area!.id, stageIndex), coreCount);
    if (after && !before) store.recordAttempt(area!.id, stageIndex, true);
  }

  return (
    <main className="app-page app-page--area area">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link className="breadcrumb__link" to="/">
          {titleCase(area.subject)}
        </Link>{" "}
        / {titleCase(area.topic)} / {titleCase(area.topicArea)}
      </nav>

      <header className="area-head">
        <h1 className="sel-title">{area.title}</h1>
        <p className="area-meta">
          {area.stages.length} stage{area.stages.length === 1 ? "" : "s"} · {questionTotal} question
          {questionTotal === 1 ? "" : "s"}
        </p>
      </header>

      {complete ? (
        <div className="area-complete">
          <p className="area-complete__text">
            <Check size={18} aria-hidden="true" /> You’ve completed every stage in this area.
          </p>
          <Link className="btn btn--ghost" to="/">
            Back to library
          </Link>
        </div>
      ) : null}

      {area.stages.map((stage, i) => (
        <StageSection
          key={i}
          num={i + 1}
          stage={stage}
          status={statuses[i]!}
          areaId={area.id}
          store={store}
          onCore={recordCore}
        />
      ))}
    </main>
  );
}

function StageSection({
  num,
  stage,
  status,
  areaId,
  store,
  onCore,
}: {
  num: number;
  stage: ResolvedStage;
  status: StageStatus;
  areaId: string;
  store: ProgressStore;
  onCore: (stageIndex: number, qIndex: number, outcome: Outcome, coreCount: number) => void;
}) {
  const stageIndex = num - 1;
  const rec = store.getStageProgress(areaId, stageIndex);
  const coreOutcomes = rec?.core ?? {};
  const extraOutcomes = rec?.extra ?? {};

  return (
    <section className="ws-segment" id={stageAnchor(num)} aria-label={`Stage ${num}: ${stage.title}`}>
      <header className="ws-seg-head">
        <StatusCircle variant={stageVariant(status)} size="md" value={num} label={stageStatusLabel(status)} />
        <div className="ws-seg-headtext">
          <p className="section-label">Stage {num}</p>
          <h2 className="ws-section-head">{stage.title}</h2>
        </div>
      </header>

      {stage.notes.length > 0 ? (
        <div className="stage-notes">
          <NotesRenderer blocks={stage.notes} />
        </div>
      ) : null}

      {stage.video ? (
        <div className="ws-video">
          <VideoEmbed src={stage.video.src} title={stage.title} />
        </div>
      ) : null}

      <Worksheet
        questions={stage.exercise.questions}
        outcomes={coreOutcomes}
        onOutcome={(qIndex, outcome) =>
          onCore(stageIndex, qIndex, outcome, stage.exercise.questions.length)
        }
      />

      {stage.exercise.extra.length > 0 ? (
        <div className="stage-extra">
          <p className="section-label">More practice</p>
          <Worksheet
            questions={stage.exercise.extra}
            outcomes={extraOutcomes}
            onOutcome={(qIndex, outcome) =>
              store.recordOutcome(areaId, stageIndex, "extra", qIndex, outcome)
            }
          />
        </div>
      ) : null}
    </section>
  );
}
