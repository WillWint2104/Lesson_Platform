/**
 * @file load.ts — Lesson discovery + loading (CLAUDE.md §a, §c rule 7).
 *
 * Discovers `lesson.json` manifests under /content, resolves their notes and
 * questions (inline arrays or a sibling file path), runs the validator, and
 * returns every lesson WITH its issues. Invalid lessons are returned, not
 * dropped and not thrown.
 *
 * Content discovery mechanism: Vite's `import.meta.glob('/content/**' + '/*.json',
 * { eager: true })`. /content sits at the repo root, which is the Vite root, so
 * the absolute glob resolves it directly (no server.fs tweaks needed; the repo
 * root is already an allowed fs root). The eager map is path -> parsed JSON.
 *
 * The pure core (`buildLessonRegistry`) takes that path->json map so it can be
 * unit-tested without Vite.
 */

import type { NoteBlock, Question } from "./types";
import {
  validateManifest,
  validateNotesFile,
  validateQuestionsFile,
  type Issue,
} from "./validate";
import { resolveFigure, type FigureSchemaRegistry } from "./figure";
import { parseYouTubeId } from "@/shared/youtube";

export interface LoadOptions {
  /** Per-kind figure schemas; enables per-kind figure data validation at load. */
  figureSchemas?: FigureSchemaRegistry;
}

/** Stamp canonical figures (explicit specVersion; legacy aliases mapped) so the
 * runtime never relies on an implicit version or a deprecated field. */
function normalizeFigures(questions: Question[]): Question[] {
  return questions.map((q) => {
    const resolved = resolveFigure(q as unknown as Record<string, unknown>);
    return resolved.figure ? ({ ...q, figure: resolved.figure } as Question) : q;
  });
}

export interface ValidatedLesson {
  /** Lesson id from the manifest, or the manifest path when id is unusable. */
  id: string;
  title: string;
  /** Hierarchy derived from the directory path (CLAUDE.md §a), not the manifest. */
  subject: string;
  topic: string;
  topicArea: string;
  /** Manifest file path (glob key). */
  path: string;
  /** Video source (YouTube id/URL or null) + duration, from the manifest. */
  video: { src: string | null; duration: number | null };
  notes: NoteBlock[];
  questions: Question[];
  valid: boolean;
  errors: Issue[];
  warnings: Issue[];
}

/** The hierarchy + lesson-id segments encoded by a manifest's directory path. */
interface PathHierarchy {
  subject: string;
  topic: string;
  topicArea: string;
  lessonId: string;
}

const EXPECTED_PATH_SHAPE =
  "/content/<subject>/<topic>/<topic-area>/<lesson-id>/lesson.json";

/**
 * Derive { subject, topic, topicArea, lessonId } from a manifest path of the
 * shape /content/<subject>/<topic>/<topic-area>/<lesson-id>/lesson.json.
 * Returns null when the path has the wrong depth/shape.
 */
function deriveHierarchy(manifestPath: string): PathHierarchy | null {
  const marker = "/content/";
  const start = manifestPath.indexOf(marker);
  if (start === -1) return null;
  const rest = manifestPath.slice(start + marker.length);
  const segments = rest.split("/");
  // [subject, topic, topicArea, lessonId, "lesson.json"]
  if (segments.length !== 5 || segments[4] !== "lesson.json") return null;
  const [subject, topic, topicArea, lessonId] = segments;
  if (!subject || !topic || !topicArea || !lessonId) return null;
  return { subject, topic, topicArea, lessonId };
}

export interface LessonRegistry {
  lessons: ValidatedLesson[];
  issuesByLesson: Record<string, { errors: Issue[]; warnings: Issue[] }>;
  /** Stale-ID-safe lookup: returns undefined for unknown ids (never throws). */
  getLessonById: (id: string) => ValidatedLesson | undefined;
}

function dirOf(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? "" : path.slice(0, i + 1);
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function prefixIssues(issues: Issue[], filePath: string): Issue[] {
  return issues.map((issue) => ({ ...issue, path: `${filePath} → ${issue.path}` }));
}

/**
 * Build the lesson registry from an already-loaded path->json map. Pure: no
 * Vite, no fs — unit-testable.
 */
export function buildLessonRegistry(
  files: Record<string, unknown>,
  options: LoadOptions = {},
): LessonRegistry {
  const figureSchemas = options.figureSchemas;
  const lessons: ValidatedLesson[] = [];
  const seenIds = new Set<string>();

  const manifestPaths = Object.keys(files)
    .filter((p) => p.endsWith("/lesson.json") || p === "lesson.json")
    .sort();

  for (const manifestPath of manifestPaths) {
    const raw = files[manifestPath];
    const manifestResult = validateManifest(raw, { figureSchemas });
    const errors: Issue[] = [...manifestResult.errors];
    const warnings: Issue[] = [...manifestResult.warnings];

    const lesson =
      raw && typeof raw === "object"
        ? (raw as { lesson?: Record<string, unknown> }).lesson
        : undefined;

    // Hierarchy comes from the directory path, not the manifest.
    const hierarchy = deriveHierarchy(manifestPath);
    if (hierarchy === null) {
      errors.push({
        path: manifestPath,
        message:
          `lesson manifest path has an unexpected shape — expected ${EXPECTED_PATH_SHAPE}`,
      });
    }

    const dir = dirOf(manifestPath);

    // Resolve notes (inline array or referenced file).
    let notes: NoteBlock[] = [];
    const notesField = lesson?.["notes"];
    if (typeof notesField === "string") {
      const notesPath = dir + notesField.replace(/^\.\//, "");
      if (notesPath in files) {
        const notesRaw = files[notesPath];
        const nres = validateNotesFile(notesRaw);
        errors.push(...prefixIssues(nres.errors, notesPath));
        warnings.push(...prefixIssues(nres.warnings, notesPath));
        notes = asArray<NoteBlock>(
          (notesRaw as { notes?: unknown } | null)?.notes,
        );
      } else {
        errors.push({
          path: "lesson.notes",
          message: `referenced notes file not found: ${notesPath}`,
        });
      }
    } else {
      notes = asArray<NoteBlock>(notesField);
    }

    // Resolve questions (inline array or referenced file).
    let questions: Question[] = [];
    const questionsField = lesson?.["questions"];
    if (typeof questionsField === "string") {
      const questionsPath = dir + questionsField.replace(/^\.\//, "");
      if (questionsPath in files) {
        const questionsRaw = files[questionsPath];
        const qres = validateQuestionsFile(questionsRaw, { figureSchemas });
        errors.push(...prefixIssues(qres.errors, questionsPath));
        warnings.push(...prefixIssues(qres.warnings, questionsPath));
        questions = normalizeFigures(
          asArray<Question>((questionsRaw as { questions?: unknown } | null)?.questions),
        );
      } else {
        errors.push({
          path: "lesson.questions",
          message: `referenced questions file not found: ${questionsPath}`,
        });
      }
    } else {
      questions = normalizeFigures(asArray<Question>(questionsField));
    }

    const rawId = lesson?.["id"];
    const id = typeof rawId === "string" && rawId.trim() ? rawId : manifestPath;

    // Registry integrity: a duplicate id would make getLessonById ambiguous.
    if (seenIds.has(id)) {
      errors.push({
        path: "lesson.id",
        message: `duplicate lesson id '${id}' (ids must be unique across packs)`,
      });
    }
    seenIds.add(id);

    const title = typeof lesson?.["title"] === "string" ? (lesson["title"] as string) : "";

    const videoRaw =
      lesson?.["video"] && typeof lesson["video"] === "object"
        ? (lesson["video"] as Record<string, unknown>)
        : undefined;
    const rawSrc = typeof videoRaw?.["src"] === "string" ? (videoRaw["src"] as string) : null;
    const video = {
      // Normalise to the resolved 11-char id (the single resolver), so render
      // never re-parses a URL — null for "not recorded" or unparseable.
      src: rawSrc === null ? null : parseYouTubeId(rawSrc),
      duration: typeof videoRaw?.["duration"] === "number" ? (videoRaw["duration"] as number) : null,
    };

    lessons.push({
      id,
      title,
      subject: hierarchy?.subject ?? "",
      topic: hierarchy?.topic ?? "",
      topicArea: hierarchy?.topicArea ?? "",
      path: manifestPath,
      video,
      notes,
      questions,
      valid: errors.length === 0,
      errors,
      warnings,
    });
  }

  const issuesByLesson: LessonRegistry["issuesByLesson"] = {};
  const byId = new Map<string, ValidatedLesson>();
  for (const lesson of lessons) {
    // Keep the first lesson seen for a given id deterministic; a later duplicate
    // (already flagged with an error above) must not overwrite it.
    if (!byId.has(lesson.id)) {
      byId.set(lesson.id, lesson);
      issuesByLesson[lesson.id] = { errors: lesson.errors, warnings: lesson.warnings };
    }
  }

  return {
    lessons,
    issuesByLesson,
    // Stale-ID guard: validate against the registry; truthiness is not validity.
    getLessonById: (id: string) =>
      typeof id === "string" && byId.has(id) ? byId.get(id) : undefined,
  };
}

/**
 * Discover and load every lesson under /content via Vite glob, then build the
 * validated registry. Runtime entry point (browser/dev); the pure core is
 * `buildLessonRegistry`.
 */
export function loadAllLessons(options: LoadOptions = {}): LessonRegistry {
  const files = import.meta.glob<unknown>("/content/**/*.json", {
    eager: true,
    import: "default",
  });
  return buildLessonRegistry(files, options);
}
