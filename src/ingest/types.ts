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

/**
 * A video segment in an area's sequence. `src` is a YouTube source (watch/short/
 * embed URL or bare 11-char id) or `null` when the video isn't recorded yet
 * (a first-class state — generation may run ahead of studio recording).
 */
export interface VideoSegment {
  type: "video";
  title: string;
  src: string | null;
}

/** An exercise segment: an ordered set of questions (inline or a file path). */
export interface ExerciseSegment {
  type: "exercise";
  title: string;
  questions: Question[] | string;
}

export type AreaSegment = VideoSegment | ExerciseSegment;

export const SEGMENT_TYPES = ["video", "exercise"] as const;

/**
 * The inner area object of an `area.json` manifest. ONE page per topic area:
 * area-level notes + an ordered `sequence` of video/exercise segments. The
 * normal pattern is video→exercise pulses, but the contract does not enforce
 * any ordering or mix.
 *
 * NOTE: no `subject`/`topic`/`topicArea` — the hierarchy is derived from the
 * directory path by the loader (CLAUDE.md §a), not stored in the manifest.
 */
export interface Area {
  title: string;
  /** Area-level notes: inline blocks or a path (relative to the area dir). */
  notes: NoteBlock[] | string;
  sequence: AreaSegment[];
}

/** An `area.json` manifest. */
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
