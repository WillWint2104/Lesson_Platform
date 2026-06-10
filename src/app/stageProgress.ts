/**
 * @file stageProgress.ts — shared stage-completion derivation (pure helpers).
 *
 * A stage is "complete" when its sticky `completedAt` is set — which the
 * exercise page does the moment every CORE question has an outcome (v3
 * completion rule). Used by the stepper, the area redirect, and the hub.
 */
import type { ProgressStore } from "@/state/progress";
import type { ValidatedArea } from "@/ingest/load";
import { type StageInput, currentStageIndex } from "@/app/unlock";

export function isStageComplete(store: ProgressStore, areaId: string, stageIndex: number): boolean {
  return Boolean(store.getStageProgress(areaId, stageIndex)?.completedAt);
}

/** Whether every core question of a stage has an outcome (the completion rule). */
export function allCoreAnswered(
  outcomes: Record<number, unknown> | undefined,
  coreCount: number,
): boolean {
  if (coreCount === 0) return false;
  for (let k = 0; k < coreCount; k++) if (outcomes?.[k] === undefined) return false;
  return true;
}

export function stageInputs(area: ValidatedArea, store: ProgressStore): StageInput[] {
  return area.stages.map((_s, i) => ({ complete: isStageComplete(store, area.id, i) }));
}

/** 1-based current stage number (progress-derived) for the area redirect. */
export function currentStageNumber(area: ValidatedArea, store: ProgressStore): number {
  return currentStageIndex(stageInputs(area, store)) + 1;
}

export const areaBasePath = (a: { course: string; topic: string; topicArea: string }) =>
  `/${a.course}/${a.topic}/${a.topicArea}`;
export const stagePath = (a: { course: string; topic: string; topicArea: string }, n: number) =>
  `${areaBasePath(a)}/stage/${n}`;
export const exercisePath = (a: { course: string; topic: string; topicArea: string }, n: number) =>
  `${areaBasePath(a)}/stage/${n}/exercise`;
