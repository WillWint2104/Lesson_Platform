/**
 * @file AreaPage.tsx — TEMPORARY area page (/:subject/:topic/:topicArea).
 *
 * Renders an area's notes + its ordered sequence (video → exercise pulses) with
 * sequential exercise unlock, wired to the v2 progress store. This is a
 * minimal-but-functional placeholder; the polished worksheet UX is the NEXT PR.
 */
import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { useRegistry } from "@/app/RegistryContext";
import { useProgressStore } from "@/state/ProgressContext";
import type { ProgressStore } from "@/state/progress";
import type { ResolvedSegment } from "@/ingest/load";
import { computeSegmentUnlock, isAreaComplete, type SegmentStatus } from "@/app/unlock";
import { titleCase } from "@/app/format";
import { VideoEmbed } from "@/render/VideoEmbed";
import { NotesRenderer } from "@/render/notes/NotesRenderer";
import { QuestionRunner } from "@/render/questions/QuestionRunner";
import type { QuestionResult } from "@/render/questions/types";
import { NotFound } from "@/app/screens/NotFound";

export function AreaPage() {
  const { subject, topic, topicArea } = useParams();
  const registry = useRegistry();
  const store = useProgressStore();
  const areaId = `${subject}/${topic}/${topicArea}`;
  const area = registry.getAreaById(areaId);
  const ok = !!area && area.valid;

  useEffect(() => {
    if (ok && area) store.setLastVisited(area.id);
  }, [ok, area, store]);

  if (!ok || !area) {
    return <NotFound message="That topic area doesn’t exist." />;
  }

  const segmentInputs = area.segments.map((s, i) => ({
    type: s.type,
    complete: s.type === "exercise" ? Boolean(store.getExerciseProgress(area.id, i)?.completedAt) : false,
  }));
  const states = computeSegmentUnlock(segmentInputs);
  const complete = isAreaComplete(segmentInputs);

  return (
    <main className="app-page app-page--reading area">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link className="breadcrumb__link" to="/">
          {titleCase(area.subject)}
        </Link>{" "}
        / {titleCase(area.topic)} / {titleCase(area.topicArea)}
      </nav>
      <h1 className="sel-title">{area.title}</h1>
      {complete ? <div className="lesson-banner">✓ Area complete — all exercises done.</div> : null}

      <section className="area-section">
        <h2 className="area-seg-title">Notes</h2>
        <NotesRenderer blocks={area.notes} />
      </section>

      <section className="area-section">
        <h2 className="area-seg-title">Sequence</h2>
        {area.segments.map((seg, i) => (
          <SegmentView
            key={i}
            areaId={area.id}
            segIndex={i}
            seg={seg}
            status={states[i]!.status}
            store={store}
          />
        ))}
      </section>
    </main>
  );
}

function SegmentView({
  areaId,
  segIndex,
  seg,
  status,
  store,
}: {
  areaId: string;
  segIndex: number;
  seg: ResolvedSegment;
  status: SegmentStatus;
  store: ProgressStore;
}) {
  if (seg.type === "video") {
    return (
      <div className="area-segment">
        <h3 className="area-seg-title">▶ {seg.title}</h3>
        <VideoEmbed src={seg.src} title={seg.title} />
      </div>
    );
  }

  if (status === "locked") {
    return (
      <div className="area-segment">
        <h3 className="area-seg-title">{seg.title}</h3>
        <p className="lesson-card__locked">Complete the previous exercise to unlock this.</p>
      </div>
    );
  }

  const record = store.getExerciseProgress(areaId, segIndex);
  // Resume an incomplete exercise; a completed one re-runs fresh (review).
  const initialOutcomes = record?.completedAt ? undefined : record?.questionOutcomes;

  return (
    <div className="area-segment">
      <h3 className="area-seg-title">{seg.title}</h3>
      <QuestionRunner
        key={`${areaId}:${segIndex}`}
        questions={seg.questions}
        initialOutcomes={initialOutcomes}
        onResult={(qi, o) => store.recordOutcome(areaId, segIndex, qi, o)}
        onComplete={(results: QuestionResult[]) =>
          store.recordAttempt(
            areaId,
            segIndex,
            results.length > 0 && results.every((r) => r.outcome === "correct"),
          )
        }
      />
    </div>
  );
}
