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

/** Discriminated union on `type` for notes blocks. */
export type NoteBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "example"; prompt: string; working: string[]; answer: string }
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

export interface LessonVideo {
  src: string;
  /** Length in seconds, or null when not yet known. */
  duration: number | null;
}

/**
 * The inner lesson object of a manifest.
 *
 * NOTE: no `subject`/`topic`/`topicArea` — the hierarchy is derived from the
 * directory path by the loader (CLAUDE.md §a), not stored in the manifest.
 */
export interface Lesson {
  id: string;
  title: string;
  video: LessonVideo;
  /** Inline blocks, or a path (relative to the lesson dir) to a NotesFile. */
  notes: NoteBlock[] | string;
  /** Inline questions, or a path to a QuestionsFile. */
  questions: Question[] | string;
}

/** A `lesson.json` manifest ties video + notes + questions together. */
export interface LessonManifest {
  lesson: Lesson;
}

/** A standalone `questions.json`. */
export interface QuestionsFile {
  questions: Question[];
}

/** A standalone `notes.json`. */
export interface NotesFile {
  notes: NoteBlock[];
}
