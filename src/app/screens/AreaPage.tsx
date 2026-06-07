/**
 * @file AreaPage.tsx — one page per topic area (/:subject/:topic/:topicArea).
 *
 * The designed worksheet experience: breadcrumb → title + meta → notes → the
 * authored sequence, each segment a clearly numbered section (videos and
 * exercises numbered independently). Exercises render as worksheets (see
 * `Worksheet`); a locked exercise renders a locked card with its questions
 * hidden until the previous exercise is complete. Videos are never locked.
 *
 * Progress: per-question outcomes go to the v2 store; an exercise's `completedAt`
 * is set once every question has a "correct" outcome (consistent with
 * `isAreaComplete`). The page subscribes to the store so unlocking and
 * answered-state indicators stay live.
 *
 * (QuestionRunner is now dormant — retained for the future checkpoint/quiz mode,
 * CLAUDE.md §c rule 8/9 — and is no longer rendered here.)
 */
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { Check } from "lucide-react";
import { useRegistry } from "@/app/RegistryContext";
import { useProgressStore } from "@/state/ProgressContext";
import type { ExerciseRecord, ProgressStore } from "@/state/progress";
import type { ResolvedSegment } from "@/ingest/load";
import { computeSegmentUnlock, isAreaComplete, type SegmentStatus } from "@/app/unlock";
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

/** DOM ids for the per-segment anchors (independent video / exercise numbering). */
const videoAnchor = (n: number) => `video-${n}`;
const exerciseAnchor = (n: number) => `exercise-${n}`;

interface SegItem {
  seg: ResolvedSegment;
  index: number;
  status: SegmentStatus;
  /** Display number within its own kind (Video 1, Exercise 1, Video 2…). */
  displayNum: number;
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

  useEffect(() => {
    if (ok && area) store.setLastVisited(area.id);
  }, [ok, area, store]);

  // Deep-link: scroll to the anchored segment (hero "continue" target) on load.
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

  const segmentInputs = area.segments.map((s, i) => ({
    type: s.type,
    complete:
      s.type === "exercise" ? Boolean(store.getExerciseProgress(area.id, i)?.completedAt) : false,
  }));
  const states = computeSegmentUnlock(segmentInputs);
  const complete = isAreaComplete(segmentInputs);

  // Independent numbering for videos and exercises, in authored order.
  let videoCount = 0;
  let exerciseCount = 0;
  const items: SegItem[] = area.segments.map((seg, index) => {
    const displayNum = seg.type === "video" ? ++videoCount : ++exerciseCount;
    return { seg, index, status: states[index]!.status, displayNum };
  });
  const exerciseTotal = exerciseCount;
  const questionTotal = area.segments.reduce(
    (sum, s) => sum + (s.type === "exercise" ? s.questions.length : 0),
    0,
  );

  function recordOutcome(segIndex: number, qIndex: number, outcome: Outcome, qCount: number) {
    const isAllCorrect = (rec: ExerciseRecord | null) =>
      qCount > 0 &&
      Array.from({ length: qCount }, (_, k) => rec?.questionOutcomes[k] === "correct").every(
        Boolean,
      );

    const wasAllCorrect = isAllCorrect(store.getExerciseProgress(area!.id, segIndex));
    store.recordOutcome(area!.id, segIndex, qIndex, outcome);
    const allCorrect = isAllCorrect(store.getExerciseProgress(area!.id, segIndex));
    // Count a completed attempt on each transition INTO "all correct"; the
    // sticky completedAt is set on the first such transition and never cleared.
    if (allCorrect && !wasAllCorrect) store.recordAttempt(area!.id, segIndex, true);
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
          {exerciseTotal} exercise{exerciseTotal === 1 ? "" : "s"} · {questionTotal} question
          {questionTotal === 1 ? "" : "s"}
        </p>
      </header>

      {complete ? (
        <div className="area-complete">
          <p className="area-complete__text">
            <Check size={18} aria-hidden="true" /> You’ve completed every exercise in this area.
          </p>
          <Link className="btn btn--ghost" to="/">
            Back to library
          </Link>
        </div>
      ) : null}

      <section className="area-section" aria-label="Notes">
        <h2 className="section-label">Notes</h2>
        <NotesRenderer blocks={area.notes} />
      </section>

      {items.map((item) =>
        item.seg.type === "video" ? (
          <VideoSegmentView key={item.index} num={item.displayNum} seg={item.seg} />
        ) : (
          <ExerciseSegmentView
            key={item.index}
            num={item.displayNum}
            segIndex={item.index}
            seg={item.seg}
            status={item.status}
            areaId={area.id}
            store={store}
            onOutcome={recordOutcome}
          />
        ),
      )}
    </main>
  );
}

function VideoSegmentView({
  num,
  seg,
}: {
  num: number;
  seg: Extract<ResolvedSegment, { type: "video" }>;
}) {
  return (
    <section className="ws-segment" id={videoAnchor(num)} aria-label={`Video ${num}: ${seg.title}`}>
      <header className="ws-seg-head">
        <StatusCircle variant="play-ring" size="md" label="Video" />
        <div className="ws-seg-headtext">
          <p className="section-label">Video {num}</p>
          <h2 className="ws-section-head">{seg.title}</h2>
        </div>
      </header>
      <div className="ws-video">
        <VideoEmbed src={seg.src} title={seg.title} />
      </div>
    </section>
  );
}

/** Status-circle variant + accessible label for an exercise segment. */
function exerciseStatus(status: SegmentStatus): { variant: "check" | "play-ring" | "lock"; label: string } {
  if (status === "done") return { variant: "check", label: "Complete" };
  if (status === "locked") return { variant: "lock", label: "Locked" };
  return { variant: "play-ring", label: "Current" };
}

function ExerciseSegmentView({
  num,
  segIndex,
  seg,
  status,
  areaId,
  store,
  onOutcome,
}: {
  num: number;
  segIndex: number;
  seg: Extract<ResolvedSegment, { type: "exercise" }>;
  status: SegmentStatus;
  areaId: string;
  store: ProgressStore;
  onOutcome: (segIndex: number, qIndex: number, outcome: Outcome, qCount: number) => void;
}) {
  const locked = status === "locked";
  const { variant, label } = exerciseStatus(status);
  const head = (
    <header className="ws-seg-head">
      <StatusCircle variant={variant} size="md" label={label} />
      <div className="ws-seg-headtext">
        <p className="section-label">Exercise {num}</p>
        <h2 className="ws-section-head">{seg.title}</h2>
      </div>
    </header>
  );

  if (locked) {
    return (
      <section
        className="ws-segment ws-segment--locked"
        id={exerciseAnchor(num)}
        aria-label={`Exercise ${num} (locked): ${seg.title}`}
      >
        {head}
        <div className="ws-locked">
          <p className="ws-locked__title">
            {seg.questions.length} question{seg.questions.length === 1 ? "" : "s"} · locked
          </p>
          <p className="ws-locked__note">Finish Exercise {num - 1} first to unlock this.</p>
        </div>
      </section>
    );
  }

  const record = store.getExerciseProgress(areaId, segIndex);
  const outcomes = record?.questionOutcomes ?? {};

  return (
    <section className="ws-segment" id={exerciseAnchor(num)} aria-label={`Exercise ${num}: ${seg.title}`}>
      {head}
      <Worksheet
        questions={seg.questions}
        outcomes={outcomes}
        onOutcome={(qIndex, outcome) => onOutcome(segIndex, qIndex, outcome, seg.questions.length)}
      />
    </section>
  );
}
