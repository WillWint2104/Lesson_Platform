/**
 * @file types.ts — Lesson ingest contracts (CLAUDE.md §e).
 *
 * Source-of-truth TypeScript shapes for ingested lesson JSON. These describe
 * VALID content; the validator (validate.ts) is what guarantees an unknown blob
 * actually conforms — never trust a cast.
 *
 * NOTE: there is intentionally NO `topic` field inside questions — topic comes
 * from the content hierarchy (subject → topic → topic area → lesson).
 */

/** Optional authoring difficulty on a question. */
export type Difficulty = "easy" | "medium" | "hard";

/** Fields shared by every question regardless of `type`. */
export interface QuestionBase {
  prompt: string;
  skill?: string;
  difficulty?: Difficulty;
}

/**
 * Non-multiple-choice questions may carry an optional reveal `answer` and
 * `working` steps (both rendered through MathText). Multiple-choice does NOT —
 * its options carry correctness.
 */
export interface AnswerableBase extends QuestionBase {
  answer?: string;
  working?: string[];
  /**
   * Optional figure, dispatched by sealed (kind, specVersion) — see
   * /src/render/figures. Supersedes the deprecated graphData/geometryData.
   */
  figure?: Figure;
}

/**
 * A question figure. `kind` selects a sealed renderer family; `specVersion`
 * (default 1) pins the interpretation of `data` so existing content can never
 * be re-rendered under new semantics (CLAUDE.md §g, append-only policy).
 */
export interface Figure {
  kind: string;
  specVersion?: number;
  data: Record<string, unknown>;
}

export interface TextQuestion extends AnswerableBase {
  type: "text";
}

export interface TableQuestion extends AnswerableBase {
  type: "table";
  rows: string[][];
}

export interface GraphQuestion extends AnswerableBase {
  type: "graph";
  /** @deprecated Use `figure` ({ kind: "function-graph", data }). */
  graphData?: unknown;
}

export interface GeometryQuestion extends AnswerableBase {
  type: "geometry";
  /** @deprecated Use `figure` ({ kind: "<shape>-figure", data }). */
  geometryData?: unknown;
}

export interface MultipleChoiceOption {
  text: string;
  isCorrect: boolean;
}

export interface MultipleChoiceQuestion extends QuestionBase {
  type: "multiple-choice";
  options: MultipleChoiceOption[];
}

/** Discriminated union on `type`. */
export type Question =
  | TextQuestion
  | TableQuestion
  | GraphQuestion
  | GeometryQuestion
  | MultipleChoiceQuestion;

/** The five question `type` discriminants. */
export const QUESTION_TYPES = [
  "text",
  "table",
  "graph",
  "geometry",
  "multiple-choice",
] as const;

/** One step of a stepped worked example: a TeX line + an optional one-line why. */
export interface ExampleStep {
  tex: string;
  why?: string;
}

/** Discriminated union on `type` for notes blocks. */
export type NoteBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | {
      type: "example";
      prompt: string;
      answer: string;
      /** Stepped working (preferred): each step is a TeX line + optional why. */
      steps?: ExampleStep[];
      /** Legacy flat working lines (mutually exclusive with `steps`). */
      working?: string[];
    }
  | { type: "callout"; style: "key" | "warning" | "info"; text: string }
  | { type: "list"; items: string[] };

/** The five notes-block `type` discriminants. */
export const NOTE_BLOCK_TYPES = [
  "heading",
  "paragraph",
  "example",
  "callout",
  "list",
] as const;

/** Allowed callout styles. */
export const CALLOUT_STYLES = ["key", "warning", "info"] as const;

/**
 * A stage's video. `src` is a YouTube source (watch/short/embed URL or bare
 * 11-char id) or `null` when the video isn't recorded yet (a first-class state —
 * generation may run ahead of studio recording). `duration` is seconds or null.
 */
export interface StageVideo {
  src: string | null;
  duration: number | null;
}

/** A stage's exercise: required core questions + an optional extra-practice pool. */
export interface StageExercise {
  questions: Question[] | string;
  extra?: Question[] | string;
}

/**
 * A STAGE = one skill: optional notes, an optional video, then a REQUIRED
 * exercise. Stages are navigated as pages (Mayer segmenting principle); notes
 * belong to the stage. `notes`/`questions`/`extra` are inline arrays or a path
 * (relative to the area dir).
 */
export interface Stage {
  title: string;
  notes?: NoteBlock[] | string;
  video?: StageVideo;
  exercise: StageExercise;
}

/**
 * The inner area object of an `area.json` manifest (contract v3). An area is a
 * sequence of stages, each one skill = video then exercise.
 *
 * NOTE: no `subject`/`topic`/`topicArea` — the hierarchy is derived from the
 * directory path by the loader (CLAUDE.md §a), not stored in the manifest.
 */
export interface Area {
  title: string;
  stages: Stage[];
}

/** An `area.json` manifest (v3). */
export interface AreaManifest {
  area: Area;
}

/** A standalone `questions.json` (contract UNCHANGED). */
export interface QuestionsFile {
  questions: Question[];
}

/** A standalone `notes.json` (contract UNCHANGED). */
export interface NotesFile {
  notes: NoteBlock[];
}
