/**
 * @file types.ts — Shared question-runtime result contract.
 *
 * ONE result type + emitter path for every question type (CLAUDE.md §c rule 4):
 * both multiple-choice marking and self-marking flow through `onOutcome`, and
 * the runner aggregates into `QuestionResult[]`. No parallel result logic.
 */

export type Outcome = "correct" | "incorrect";

export interface QuestionResult {
  index: number;
  outcome: Outcome;
}

/** Every per-type body emits its result through this single callback. */
export type OutcomeHandler = (outcome: Outcome) => void;
