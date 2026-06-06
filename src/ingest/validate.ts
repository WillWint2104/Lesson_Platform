/**
 * @file validate.ts — Ingested-JSON validator (CLAUDE.md §c rule 6, §e).
 *
 * Pure functions that REPORT problems; they never throw on bad data and never
 * coerce/repair it. Every message is actionable and path-precise, e.g.
 * "questions[2]: missing required field 'prompt'".
 *
 * The most common authoring failure is an un-doubled LaTeX backslash: in JSON
 * "\frac" is parsed as form-feed + "rac", silently vanishing when rendered. We
 * catch that here by scanning content strings for control characters.
 */

import { CALLOUT_STYLES, NOTE_BLOCK_TYPES, QUESTION_TYPES } from "./types";
import { resolveFigure, schemaKey, type FigureSchemaRegistry } from "./figure";
import { parseYouTubeId, ACCEPTED_YOUTUBE_FORMATS } from "@/shared/youtube";

export interface ValidateOptions {
  /** Per-kind figure schemas (kind@specVersion → validator). When provided,
   * canonical figure `data` is validated per kind. */
  figureSchemas?: FigureSchemaRegistry;
}

export interface Issue {
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: Issue[];
  warnings: Issue[];
}

/**
 * Accumulates errors/warnings. Internal helper so every validator shares one
 * issue-collection mechanism (CLAUDE.md §c rule 4).
 */
class Report {
  readonly errors: Issue[] = [];
  readonly warnings: Issue[] = [];

  error(path: string, message: string): void {
    this.errors.push({ path, message });
  }

  warn(path: string, message: string): void {
    this.warnings.push({ path, message });
  }

  result(): ValidationResult {
    return {
      valid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
    };
  }
}

// Control characters that a mis-escaped LaTeX backslash decays into after
// JSON.parse: \b \t \n \v \f \r (backspace, tab, newline, vertical-tab,
// form-feed, carriage-return). Inside a character class, \b means backspace.
const CONTROL_CHARS = /[\b\t\n\v\f\r]/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Scan a content string for control characters — the un-doubled-LaTeX tripwire.
 * Adds an error (not a warning) because such content renders as nothing.
 */
function scanLatex(report: Report, path: string, value: unknown): void {
  if (typeof value === "string" && CONTROL_CHARS.test(value)) {
    report.error(
      path,
      "contains a control character — likely an un-doubled LaTeX backslash " +
        "(write \\\\frac not \\frac in JSON)",
    );
  }
}

/** Warn about object keys not part of the known shape (forward-compat). */
function warnUnknownFields(
  report: Report,
  path: string,
  obj: Record<string, unknown>,
  known: readonly string[],
): void {
  for (const key of Object.keys(obj)) {
    if (!known.includes(key)) {
      report.warn(path, `unknown field '${key}' (ignored)`);
    }
  }
}

/**
 * Require a non-empty string field. Returns true when present & valid so callers
 * can short-circuit further checks.
 */
function requireString(
  report: Report,
  path: string,
  obj: Record<string, unknown>,
  field: string,
): boolean {
  const value = obj[field];
  if (value === undefined || value === null) {
    report.error(path, `missing required field '${field}'`);
    return false;
  }
  if (typeof value !== "string") {
    report.error(path, `field '${field}' must be a string`);
    return false;
  }
  if (value.trim().length === 0) {
    report.error(path, `required field '${field}' must not be empty`);
    return false;
  }
  scanLatex(report, path, value);
  return true;
}

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------

const QUESTION_BASE_FIELDS = ["type", "prompt", "skill", "difficulty"] as const;
const DIFFICULTIES = ["easy", "medium", "hard"];

function validateQuestion(
  report: Report,
  path: string,
  raw: unknown,
  figureSchemas?: FigureSchemaRegistry,
): void {
  if (!isPlainObject(raw)) {
    report.error(path, "must be an object");
    return;
  }

  // `topic` is explicitly forbidden on questions — topic comes from the content
  // hierarchy (CLAUDE.md §e). This is a hard error, not a forward-compat warning.
  if ("topic" in raw) {
    report.error(
      path,
      "field 'topic' is not allowed on questions — topic comes from the content hierarchy",
    );
  }

  const type = raw["type"];
  if (type === undefined || type === null || type === "") {
    report.error(path, "missing required field 'type'");
  } else if (typeof type !== "string" || !QUESTION_TYPES.includes(type as never)) {
    report.error(
      path,
      `unknown question type ${JSON.stringify(type)} — expected one of ` +
        QUESTION_TYPES.join(" | "),
    );
  }

  requireString(report, path, raw, "prompt");

  // Optional difficulty: present-but-out-of-enum is a warning, not an error.
  if (raw["difficulty"] !== undefined) {
    const d = raw["difficulty"];
    if (typeof d !== "string" || !DIFFICULTIES.includes(d)) {
      report.warn(
        path,
        `difficulty ${JSON.stringify(d)} is not one of ${DIFFICULTIES.join(" | ")} (ignored)`,
      );
    }
  }

  let knownFields: readonly string[] = QUESTION_BASE_FIELDS;
  // Optional reveal answer/working — allowed on every type EXCEPT
  // multiple-choice (whose options carry correctness).
  const ANSWER_FIELDS = ["answer", "working"] as const;

  const FIGURE_FIELD = "figure";

  switch (type) {
    case "text":
      knownFields = [...QUESTION_BASE_FIELDS, ...ANSWER_FIELDS, FIGURE_FIELD];
      validateAnswerWorking(report, path, raw);
      validateFigure(report, path, raw, figureSchemas);
      // A text question with no answer is allowed, but warn: the runtime can
      // only self-mark (no reveal) without one.
      if (raw["answer"] === undefined) {
        report.warn(
          `${path} (text)`,
          "no answer provided — the runtime will fall back to self-marking without a reveal",
        );
      }
      break;
    case "table":
      knownFields = [...QUESTION_BASE_FIELDS, "rows", ...ANSWER_FIELDS, FIGURE_FIELD];
      validateTableRows(report, `${path} (table)`, raw["rows"]);
      validateAnswerWorking(report, path, raw);
      validateFigure(report, path, raw, figureSchemas);
      break;
    case "graph":
      knownFields = [...QUESTION_BASE_FIELDS, "graphData", ...ANSWER_FIELDS, FIGURE_FIELD];
      validateAnswerWorking(report, path, raw);
      validateFigure(report, path, raw, figureSchemas);
      break;
    case "geometry":
      knownFields = [...QUESTION_BASE_FIELDS, "geometryData", ...ANSWER_FIELDS, FIGURE_FIELD];
      validateAnswerWorking(report, path, raw);
      validateFigure(report, path, raw, figureSchemas);
      break;
    case "multiple-choice":
      knownFields = [...QUESTION_BASE_FIELDS, "options"];
      validateMcOptions(report, `${path} (multiple-choice)`, raw["options"]);
      break;
    default:
      // Unknown type already reported above.
      break;
  }

  // `topic` is already reported as an error above; list it here so it is not
  // also double-reported as an unknown-field warning.
  warnUnknownFields(report, path, raw, [...knownFields, "topic"]);
}

/** Validate the optional reveal `answer` (string) and `working` (string[]). */
function validateAnswerWorking(
  report: Report,
  path: string,
  raw: Record<string, unknown>,
): void {
  const answer = raw["answer"];
  if (answer !== undefined) {
    if (typeof answer !== "string") {
      report.error(path, "field 'answer' must be a string");
    } else {
      scanLatex(report, path, answer);
    }
  }

  const working = raw["working"];
  if (working !== undefined) {
    if (!Array.isArray(working) || !working.every((w) => typeof w === "string")) {
      report.error(path, "working must be an array of strings (string[])");
    } else {
      working.forEach((w, i) => scanLatex(report, `${path}.working[${i}]`, w));
    }
  }
}

/**
 * Validate the optional `figure` (or a deprecated graphData/geometryData alias).
 * The canonical figure has its envelope checked and, when schemas are provided,
 * its `data` validated per (kind, specVersion). Aliases get a deprecation
 * warning but are NOT re-validated against the new schemas (lenient back-compat).
 */
function validateFigure(
  report: Report,
  path: string,
  raw: Record<string, unknown>,
  figureSchemas?: FigureSchemaRegistry,
): void {
  const resolved = resolveFigure(raw);
  if (resolved.source === "none") return;

  if (resolved.source === "graphData") {
    report.warn(
      path,
      'field \'graphData\' is deprecated — use figure: { kind: "function-graph", data: ... }',
    );
    return;
  }
  if (resolved.source === "geometryData") {
    report.warn(
      path,
      'field \'geometryData\' is deprecated — use figure: { kind: "<shape>-figure", data: ... }',
    );
    return;
  }

  // Canonical `figure` field — validate the envelope.
  const figPath = `${path}.figure`;
  const fig = raw["figure"] as Record<string, unknown>;
  if (!isNonEmptyString(fig["kind"])) {
    report.error(figPath, "missing or empty required field 'kind'");
    return;
  }
  if (
    fig["specVersion"] !== undefined &&
    (typeof fig["specVersion"] !== "number" ||
      !Number.isInteger(fig["specVersion"]) ||
      (fig["specVersion"] as number) < 1)
  ) {
    report.error(figPath, "field 'specVersion' must be a positive integer");
  }
  if (!isPlainObject(fig["data"])) {
    report.error(figPath, "field 'data' must be an object");
    return;
  }
  warnUnknownFields(report, figPath, fig, ["kind", "specVersion", "data"]);

  const canonical = resolved.figure!;
  const key = schemaKey(canonical.kind, canonical.specVersion ?? 1);
  const schema = figureSchemas?.get(key);
  if (schema) {
    for (const issue of schema(canonical.data, `${figPath}.data`)) {
      report.error(issue.path, issue.message);
    }
  } else if (figureSchemas) {
    report.warn(
      figPath,
      `no schema registered for figure kind '${canonical.kind}' specVersion ${canonical.specVersion} (data not validated)`,
    );
  }
}

function validateTableRows(report: Report, path: string, rows: unknown): void {
  if (rows === undefined) {
    report.error(path, "missing required field 'rows'");
    return;
  }
  if (
    !Array.isArray(rows) ||
    !rows.every(
      (row) => Array.isArray(row) && row.every((cell) => typeof cell === "string"),
    )
  ) {
    report.error(path, "rows must be an array of string arrays (string[][])");
    return;
  }
  rows.forEach((row, i) => {
    (row as string[]).forEach((cell, j) => {
      scanLatex(report, `${path}.rows[${i}][${j}]`, cell);
    });
  });
}

function validateMcOptions(report: Report, path: string, options: unknown): void {
  if (options === undefined) {
    report.error(path, "missing required field 'options'");
    return;
  }
  if (!Array.isArray(options) || options.length === 0) {
    report.error(path, "options must contain at least one option");
    return;
  }

  let correctCount = 0;
  options.forEach((opt, i) => {
    const optPath = `${path}.options[${i}]`;
    if (!isPlainObject(opt)) {
      report.error(optPath, "must be an object with 'text' and 'isCorrect'");
      return;
    }
    if (!isNonEmptyString(opt["text"])) {
      report.error(optPath, "missing or empty required field 'text'");
    } else {
      scanLatex(report, optPath, opt["text"]);
    }
    if (typeof opt["isCorrect"] !== "boolean") {
      report.error(optPath, "field 'isCorrect' must be a boolean");
    } else if (opt["isCorrect"]) {
      correctCount += 1;
    }
    warnUnknownFields(report, optPath, opt, ["text", "isCorrect"]);
  });

  if (correctCount === 0) {
    report.error(path, "options must contain at least one isCorrect: true");
  } else if (correctCount > 1) {
    report.error(
      path,
      `exactly one option may have isCorrect: true (found ${correctCount})`,
    );
  }
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

function validateNoteBlock(report: Report, path: string, raw: unknown): void {
  if (!isPlainObject(raw)) {
    report.error(path, "must be an object");
    return;
  }

  const type = raw["type"];
  if (type === undefined || type === null || type === "") {
    report.error(path, "missing required field 'type'");
    return;
  }
  if (typeof type !== "string" || !NOTE_BLOCK_TYPES.includes(type as never)) {
    report.error(
      path,
      `unknown block type ${JSON.stringify(type)} — expected one of ` +
        NOTE_BLOCK_TYPES.join(" | "),
    );
    return;
  }

  switch (type) {
    case "heading":
    case "paragraph":
      requireString(report, path, raw, "text");
      warnUnknownFields(report, path, raw, ["type", "text"]);
      break;
    case "example":
      requireString(report, path, raw, "prompt");
      validateStringArray(report, `${path} (example)`, raw, "working");
      requireString(report, path, raw, "answer");
      warnUnknownFields(report, path, raw, ["type", "prompt", "working", "answer"]);
      break;
    case "callout": {
      const style = raw["style"];
      if (typeof style !== "string" || !CALLOUT_STYLES.includes(style as never)) {
        report.error(
          `${path} (callout)`,
          `style must be one of ${CALLOUT_STYLES.join(" | ")}`,
        );
      }
      requireString(report, path, raw, "text");
      warnUnknownFields(report, path, raw, ["type", "style", "text"]);
      break;
    }
    case "list":
      validateStringArray(report, `${path} (list)`, raw, "items");
      warnUnknownFields(report, path, raw, ["type", "items"]);
      break;
    default:
      break;
  }
}

function validateStringArray(
  report: Report,
  path: string,
  obj: Record<string, unknown>,
  field: string,
): void {
  const value = obj[field];
  if (value === undefined) {
    report.error(path, `missing required field '${field}'`);
    return;
  }
  if (!Array.isArray(value) || !value.every((v) => typeof v === "string")) {
    report.error(path, `${field} must be an array of strings (string[])`);
    return;
  }
  value.forEach((v, i) => scanLatex(report, `${path}.${field}[${i}]`, v));
}

// ---------------------------------------------------------------------------
// Public entry points
// ---------------------------------------------------------------------------

/** Validate a `questions.json` (or any { questions: [...] } payload). */
export function validateQuestionsFile(
  raw: unknown,
  options: ValidateOptions = {},
): ValidationResult {
  const report = new Report();
  if (!isPlainObject(raw)) {
    report.error("questions", "file must be an object with a 'questions' array");
    return report.result();
  }
  validateQuestionArray(report, "questions", raw["questions"], options.figureSchemas);
  return report.result();
}

/** Validate a `notes.json` (or any { notes: [...] } payload). */
export function validateNotesFile(raw: unknown): ValidationResult {
  const report = new Report();
  if (!isPlainObject(raw)) {
    report.error("notes", "file must be an object with a 'notes' array");
    return report.result();
  }
  validateNoteArray(report, "notes", raw["notes"]);
  return report.result();
}

/** Validate a `lesson.json` manifest, including any inline notes/questions. */
export function validateManifest(raw: unknown, options: ValidateOptions = {}): ValidationResult {
  const report = new Report();

  if (!isPlainObject(raw)) {
    report.error("lesson", "manifest must be an object with a 'lesson' field");
    return report.result();
  }
  const lesson = raw["lesson"];
  if (!isPlainObject(lesson)) {
    report.error("lesson", "missing required field 'lesson'");
    return report.result();
  }

  requireString(report, "lesson", lesson, "id");
  requireString(report, "lesson", lesson, "title");
  validateVideo(report, "lesson.video", lesson["video"]);

  // Hierarchy (subject/topic/topicArea) is derived from the directory path by
  // the loader and must NOT appear in the manifest.
  for (const field of ["subject", "topic", "topicArea"]) {
    if (field in lesson) {
      report.error(
        `lesson.${field}`,
        "manifest: hierarchy fields are not allowed — subject/topic/topicArea " +
          "are derived from the directory path",
      );
    }
  }

  // notes/questions may be inline arrays or a string path (resolved by loader).
  const notes = lesson["notes"];
  if (typeof notes === "string") {
    if (!isNonEmptyString(notes)) report.error("lesson.notes", "notes path must not be empty");
  } else {
    validateNoteArray(report, "lesson.notes", notes);
  }

  const questions = lesson["questions"];
  if (typeof questions === "string") {
    if (!isNonEmptyString(questions)) {
      report.error("lesson.questions", "questions path must not be empty");
    }
  } else {
    validateQuestionArray(report, "lesson.questions", questions, options.figureSchemas);
  }

  // Hierarchy fields are reported as errors above; list them as "known" so they
  // are not also double-reported as unknown-field warnings.
  warnUnknownFields(report, "lesson", lesson, [
    "id",
    "title",
    "video",
    "notes",
    "questions",
    "subject",
    "topic",
    "topicArea",
  ]);

  return report.result();
}

function validateVideo(report: Report, path: string, video: unknown): void {
  if (!isPlainObject(video)) {
    report.error(path, "missing required field 'video'");
    return;
  }
  // src may be null (authored before recording) or a parseable YouTube source.
  const src = video["src"];
  if (src === undefined) {
    report.error(path, "missing required field 'src' (use null if no video yet)");
  } else if (src !== null) {
    if (typeof src !== "string" || !isNonEmptyString(src)) {
      report.error(path, "field 'src' must be a non-empty string, or null if no video yet");
    } else if (parseYouTubeId(src) === null) {
      report.error(
        path,
        `field 'src' could not be parsed as a YouTube video — accepted: ${ACCEPTED_YOUTUBE_FORMATS}`,
      );
    }
  }
  const duration = video["duration"];
  if (duration === undefined) {
    report.error(path, "missing required field 'duration' (use null if unknown)");
  } else if (duration !== null && typeof duration !== "number") {
    report.error(path, "field 'duration' must be a number or null");
  }
  warnUnknownFields(report, path, video, ["src", "duration"]);
}

/** Walk a questions array (shared by file + inline-manifest paths). */
function validateQuestionArray(
  report: Report,
  path: string,
  arr: unknown,
  figureSchemas?: FigureSchemaRegistry,
): void {
  if (!Array.isArray(arr)) {
    report.error(path, "must be an array of questions");
    return;
  }
  arr.forEach((q, i) => validateQuestion(report, `${path}[${i}]`, q, figureSchemas));
}

/** Walk a notes array (shared by file + inline-manifest paths). */
function validateNoteArray(report: Report, path: string, arr: unknown): void {
  if (!Array.isArray(arr)) {
    report.error(path, "must be an array of note blocks");
    return;
  }
  arr.forEach((b, i) => validateNoteBlock(report, `${path}[${i}]`, b));
}
