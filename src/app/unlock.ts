/**
 * @file unlock.ts — stage status derivation (pure, tested).
 *
 * v3 does NOT lock anything: stepper navigation is free in both directions
 * (Mayer segmenting — the learner controls pacing). This module only DERIVES a
 * display status per stage:
 *   - done     — the stage's core exercise is complete
 *   - current  — the first stage with an incomplete exercise (else the last stage)
 *   - upcoming — any other incomplete stage
 */

export type StageStatus = "done" | "current" | "upcoming";

export interface StageInput {
  /** Whether the stage's CORE exercise is complete (all core questions answered). */
  complete: boolean;
}

/** Index of the "current" stage: first incomplete, else the last stage (0 if empty). */
export function currentStageIndex(stages: StageInput[]): number {
  const idx = stages.findIndex((s) => !s.complete);
  if (idx >= 0) return idx;
  return stages.length > 0 ? stages.length - 1 : 0;
}

/** Per-stage display status (done / current / upcoming). Nothing locks. */
export function computeStageStatus(stages: StageInput[]): StageStatus[] {
  const current = currentStageIndex(stages);
  return stages.map((s, i) => (s.complete ? "done" : i === current ? "current" : "upcoming"));
}

/** True when every stage's core exercise is complete (area complete). */
export function isAreaComplete(stages: StageInput[]): boolean {
  return stages.length > 0 && stages.every((s) => s.complete);
}
