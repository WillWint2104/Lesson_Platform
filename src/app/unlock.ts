/**
 * @file unlock.ts — sequential lesson-unlock logic (pure, unit-tested).
 *
 * Lesson i is unlocked iff i === 0 OR lesson i−1 is completed. "Current" is the
 * first unlocked-but-incomplete lesson. Completed lessons stay openable (Review).
 */

export type LessonStatus = "done" | "current" | "locked";

export interface UnlockState {
  index: number;
  status: LessonStatus;
  /** Whether the lesson can be opened (done or current). */
  unlocked: boolean;
}

/** Given each lesson's completed flag (in order), classify every lesson. */
export function computeUnlockStates(completed: boolean[]): UnlockState[] {
  const states: UnlockState[] = [];
  let currentTaken = false;
  for (let i = 0; i < completed.length; i++) {
    const prevDone = i === 0 || completed[i - 1] === true;
    let status: LessonStatus;
    if (completed[i]) {
      status = "done";
    } else if (prevDone && !currentTaken) {
      status = "current";
      currentTaken = true;
    } else {
      status = "locked";
    }
    states.push({ index: i, status, unlocked: status !== "locked" });
  }
  return states;
}
