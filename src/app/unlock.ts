/**
 * @file unlock.ts — sequential segment-unlock logic for an area (pure, tested).
 *
 * Within an area's ordered sequence: VIDEO segments never block and are always
 * open. An EXERCISE segment is unlocked iff every exercise segment BEFORE it is
 * complete. "Current" is the first unlocked-but-incomplete exercise. Completed
 * exercises stay open.
 */

export type SegmentStatus = "video" | "done" | "current" | "locked";

export interface SegmentInput {
  type: "video" | "exercise";
  /** For exercises: whether the segment is complete. Ignored for videos. */
  complete: boolean;
}

export interface SegmentState {
  index: number;
  type: "video" | "exercise";
  status: SegmentStatus;
  /** Whether the segment can be opened (videos + done/current exercises). */
  unlocked: boolean;
}

export function computeSegmentUnlock(segments: SegmentInput[]): SegmentState[] {
  const states: SegmentState[] = [];
  let priorExerciseIncomplete = false; // once true, later exercises lock
  let currentTaken = false;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    if (seg.type === "video") {
      states.push({ index: i, type: "video", status: "video", unlocked: true });
      continue;
    }
    const unlocked = !priorExerciseIncomplete;
    let status: SegmentStatus;
    if (seg.complete) {
      status = "done";
    } else if (unlocked && !currentTaken) {
      status = "current";
      currentTaken = true;
    } else {
      status = "locked";
    }
    if (!seg.complete) priorExerciseIncomplete = true;
    states.push({ index: i, type: "exercise", status, unlocked: status !== "locked" });
  }

  return states;
}

/** True when every exercise segment is complete (area complete). Videos ignored. */
export function isAreaComplete(segments: SegmentInput[]): boolean {
  const exercises = segments.filter((s) => s.type === "exercise");
  return exercises.length > 0 && exercises.every((s) => s.complete);
}
