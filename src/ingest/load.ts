/**
 * @file load.ts — Area discovery + loading (CLAUDE.md §a, §c rule 7).
 *
 * Discovers `area.json` manifests under /content, resolves each STAGE's notes,
 * video, core questions, and optional extra-practice pool (inline or referenced
 * file paths), normalises video sources + figures, runs the validator, and
 * returns every area WITH its issues. Invalid areas are returned, not dropped
 * and not thrown. A stray superseded `lesson.json` is surfaced as an invalid
 * area carrying the migration error.
 *
 * Discovery: Vite's `import.meta.glob('/content/**' + '/*.json', { eager: true })`.
 * The pure core (`buildAreaRegistry`) takes the path->json map so it is
 * unit-testable without Vite.
 */

import type { CourseStream, NoteBlock, Question, Stage } from "./types";
import { DEFAULT_COURSE_SUBJECT } from "./types";
import {
  validateAreaManifest,
  validateCourseManifest,
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

/** A resolved stage: notes/questions inlined, video src normalised to an id/null. */
export interface ResolvedStage {
  title: string;
  notes: NoteBlock[];
  video: { src: string | null; duration: number | null } | null;
  exercise: { questions: Question[]; extra: Question[] };
}

export interface ValidatedArea {
  /** areaId = `<course>/<topic>/<topicArea>` (path-derived, unique). */
  id: string;
  title: string;
  /**
   * Hierarchy derived from the directory path (content-architecture-v1 §2), not
   * the manifest. `course` is the top path segment (the course slug, e.g.
   * `year-8`).
   */
  course: string;
  topic: string;
  topicArea: string;
  /** Manifest file path (glob key). */
  path: string;
  stages: ResolvedStage[];
  valid: boolean;
  errors: Issue[];
  warnings: Issue[];
}

interface AreaHierarchy {
  course: string;
  topic: string;
  topicArea: string;
}

/**
 * A validated course (content-architecture-v1 §3), derived by scanning
 * `/content/<course>/course.json`. `areaCount` is how many areas live under the
 * course (0 = registered-but-unauthored → "content coming", never an error).
 */
export interface ValidatedCourse {
  id: string;
  displayName: string;
  year: number;
  stream: CourseStream | null;
  subject: string;
  order: number;
  /** Manifest file path (glob key). */
  path: string;
  areaCount: number;
  valid: boolean;
  errors: Issue[];
  warnings: Issue[];
}

const EXPECTED_PATH_SHAPE = "/content/<course>/<topic>/<topic-area>/area.json";
const EXPECTED_COURSE_PATH_SHAPE = "/content/<course>/course.json";

/** Derive the course folder id from a `/content/<course>/course.json` path, or null. */
function deriveCourseId(manifestPath: string): string | null {
  const marker = "/content/";
  const start = manifestPath.indexOf(marker);
  if (start === -1) return null;
  const segments = manifestPath.slice(start + marker.length).split("/");
  // [course, "course.json"]
  if (segments.length !== 2 || segments[1] !== "course.json") return null;
  return segments[0] || null;
}

/** Derive { course, topic, topicArea } from a `.../area.json` path, or null. */
function deriveAreaHierarchy(manifestPath: string): AreaHierarchy | null {
  const marker = "/content/";
  const start = manifestPath.indexOf(marker);
  if (start === -1) return null;
  const segments = manifestPath.slice(start + marker.length).split("/");
  // [course, topic, topicArea, "area.json"]
  if (segments.length !== 4 || segments[3] !== "area.json") return null;
  const [course, topic, topicArea] = segments;
  if (!course || !topic || !topicArea) return null;
  return { course, topic, topicArea };
}

export interface AreaRegistry {
  areas: ValidatedArea[];
  /** All courses (content-architecture-v1 §3), sorted by `order` then id. */
  courses: ValidatedCourse[];
  issuesByArea: Record<string, { errors: Issue[]; warnings: Issue[] }>;
  /** Stale-ID-safe lookup: returns undefined for unknown ids (never throws). */
  getAreaById: (id: string) => ValidatedArea | undefined;
  /** All courses, sorted by `order`. */
  getCourses: () => ValidatedCourse[];
  /** Stale-ID-safe course lookup: undefined for unknown ids. */
  getCourseById: (id: string) => ValidatedCourse | undefined;
  /** Distinct course slugs that have at least one area (path-derived). */
  getCourseSlugs: () => string[];
  getTopics: (course: string) => string[];
  /** Distinct topic-area names within a topic, alphabetical. */
  getTopicAreas: (course: string, topic: string) => string[];
  /** Areas within a topic, sorted by topic-area name. */
  getAreasInTopic: (course: string, topic: string) => ValidatedArea[];
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

function normalizeFigures(questions: Question[]): Question[] {
  return questions.map((q) => {
    const resolved = resolveFigure(q as unknown as Record<string, unknown>);
    return resolved.figure ? ({ ...q, figure: resolved.figure } as Question) : q;
  });
}

interface ResolveCtx {
  dir: string;
  files: Record<string, unknown>;
  errors: Issue[];
  warnings: Issue[];
  figureSchemas?: FigureSchemaRegistry;
}

/** Resolve a notes field (inline array or referenced path) into NoteBlock[]. */
function resolveNotes(ctx: ResolveCtx, field: unknown, at: string): NoteBlock[] {
  if (typeof field === "string") {
    const notesPath = ctx.dir + field.replace(/^\.\//, "");
    if (notesPath in ctx.files) {
      const notesRaw = ctx.files[notesPath];
      const res = validateNotesFile(notesRaw);
      ctx.errors.push(...prefixIssues(res.errors, notesPath));
      ctx.warnings.push(...prefixIssues(res.warnings, notesPath));
      return asArray<NoteBlock>((notesRaw as { notes?: unknown } | null)?.notes);
    }
    ctx.errors.push({ path: at, message: `referenced notes file not found: ${notesPath}` });
    return [];
  }
  return asArray<NoteBlock>(field);
}

/** Resolve a question pool (inline array or referenced path) into Question[]. */
function resolveQuestions(ctx: ResolveCtx, field: unknown, at: string): Question[] {
  if (typeof field === "string") {
    const qPath = ctx.dir + field.replace(/^\.\//, "");
    if (qPath in ctx.files) {
      const qRaw = ctx.files[qPath];
      const res = validateQuestionsFile(qRaw, { figureSchemas: ctx.figureSchemas });
      ctx.errors.push(...prefixIssues(res.errors, qPath));
      ctx.warnings.push(...prefixIssues(res.warnings, qPath));
      const questions = normalizeFigures(
        asArray<Question>((qRaw as { questions?: unknown } | null)?.questions),
      );
      if (questions.length === 0) {
        ctx.errors.push({ path: at, message: "must contain at least one question" });
      }
      return questions;
    }
    ctx.errors.push({ path: at, message: `referenced questions file not found: ${qPath}` });
    return [];
  }
  return normalizeFigures(asArray<Question>(field));
}

/** Build the area registry from an already-loaded path->json map. Pure. */
export function buildAreaRegistry(
  files: Record<string, unknown>,
  options: LoadOptions = {},
): AreaRegistry {
  const figureSchemas = options.figureSchemas;
  const areas: ValidatedArea[] = [];
  const seenIds = new Set<string>();

  // Discover area manifests AND stray superseded lesson manifests.
  const manifestPaths = Object.keys(files)
    .filter((p) => p.endsWith("/area.json") || p.endsWith("/lesson.json"))
    .sort();

  for (const manifestPath of manifestPaths) {
    const raw = files[manifestPath];
    const manifestResult = validateAreaManifest(raw, { figureSchemas });
    const errors: Issue[] = [...manifestResult.errors];
    const warnings: Issue[] = [...manifestResult.warnings];

    const area =
      raw && typeof raw === "object"
        ? (raw as { area?: Record<string, unknown> }).area
        : undefined;

    const hierarchy = deriveAreaHierarchy(manifestPath);
    if (hierarchy === null) {
      errors.push({
        path: manifestPath,
        message: `area manifest path has an unexpected shape — expected ${EXPECTED_PATH_SHAPE}`,
      });
    }

    const ctx: ResolveCtx = { dir: dirOf(manifestPath), files, errors, warnings, figureSchemas };

    // Resolve each stage.
    const stages: ResolvedStage[] = [];
    const rawStages = asArray<Stage>(area?.["stages"]);
    rawStages.forEach((stageRaw, i) => {
      const stage = stageRaw as unknown as Record<string, unknown>;
      const sp = `area.stages[${i}]`;
      const title = typeof stage["title"] === "string" ? (stage["title"] as string) : "";

      const notes =
        stage["notes"] === undefined ? [] : resolveNotes(ctx, stage["notes"], `${sp}.notes`);

      let video: ResolvedStage["video"] = null;
      const videoRaw = stage["video"];
      if (videoRaw && typeof videoRaw === "object" && !Array.isArray(videoRaw)) {
        const v = videoRaw as Record<string, unknown>;
        const src = typeof v["src"] === "string" ? parseYouTubeId(v["src"] as string) : null;
        const duration = typeof v["duration"] === "number" ? (v["duration"] as number) : null;
        video = { src, duration };
      }

      const exerciseRaw =
        stage["exercise"] && typeof stage["exercise"] === "object"
          ? (stage["exercise"] as Record<string, unknown>)
          : {};
      const questions = resolveQuestions(ctx, exerciseRaw["questions"], `${sp}.exercise.questions`);
      const extra =
        exerciseRaw["extra"] === undefined
          ? []
          : resolveQuestions(ctx, exerciseRaw["extra"], `${sp}.exercise.extra`);

      stages.push({ title, notes, video, exercise: { questions, extra } });
    });

    const id = hierarchy
      ? `${hierarchy.course}/${hierarchy.topic}/${hierarchy.topicArea}`
      : manifestPath;

    if (seenIds.has(id)) {
      errors.push({ path: "area", message: `duplicate area id '${id}'` });
    }
    seenIds.add(id);

    const title = typeof area?.["title"] === "string" ? (area["title"] as string) : "";

    areas.push({
      id,
      title,
      course: hierarchy?.course ?? "",
      topic: hierarchy?.topic ?? "",
      topicArea: hierarchy?.topicArea ?? "",
      path: manifestPath,
      stages,
      valid: errors.length === 0,
      errors,
      warnings,
    });
  }

  const issuesByArea: AreaRegistry["issuesByArea"] = {};
  const byId = new Map<string, ValidatedArea>();
  for (const area of areas) {
    if (!byId.has(area.id)) {
      byId.set(area.id, area);
      issuesByArea[area.id] = { errors: area.errors, warnings: area.warnings };
    }
  }

  // ---- Course discovery (content-architecture-v1 §3) ----
  // Areas namespace under their top path segment (the course slug); count them
  // per course so an authored course shows its progress and an empty one is a
  // calm "content coming", never an error.
  const areaCountByCourse = new Map<string, number>();
  for (const area of areas) {
    areaCountByCourse.set(area.course, (areaCountByCourse.get(area.course) ?? 0) + 1);
  }

  const courses: ValidatedCourse[] = [];
  const seenCourseIds = new Set<string>();
  const coursePaths = Object.keys(files)
    .filter((p) => p.endsWith("/course.json"))
    .sort();
  for (const coursePath of coursePaths) {
    const raw = files[coursePath];
    const folderId = deriveCourseId(coursePath);
    const res = validateCourseManifest(raw, folderId ? { folderId } : {});
    const errors: Issue[] = [...res.errors];
    const warnings: Issue[] = [...res.warnings];
    if (folderId === null) {
      errors.push({
        path: coursePath,
        message: `course manifest path has an unexpected shape — expected ${EXPECTED_COURSE_PATH_SHAPE}`,
      });
    }
    const m = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const id = folderId ?? (typeof m["id"] === "string" ? (m["id"] as string) : coursePath);
    if (seenCourseIds.has(id)) {
      errors.push({ path: coursePath, message: `duplicate course id '${id}'` });
    }
    seenCourseIds.add(id);
    courses.push({
      id,
      displayName: typeof m["displayName"] === "string" ? (m["displayName"] as string) : id,
      year: typeof m["year"] === "number" ? (m["year"] as number) : 0,
      stream: (m["stream"] as CourseStream | null | undefined) ?? null,
      subject: typeof m["subject"] === "string" ? (m["subject"] as string) : DEFAULT_COURSE_SUBJECT,
      order: typeof m["order"] === "number" ? (m["order"] as number) : 0,
      path: coursePath,
      areaCount: areaCountByCourse.get(id) ?? 0,
      valid: errors.length === 0,
      errors,
      warnings,
    });
  }
  courses.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  const courseById = new Map<string, ValidatedCourse>();
  for (const c of courses) if (!courseById.has(c.id)) courseById.set(c.id, c);

  const distinctSorted = (values: string[]) => Array.from(new Set(values)).sort();
  // A stray/superseded manifest (e.g. lesson.json) yields an area with empty
  // hierarchy segments; exclude those so discovery never surfaces blank buckets.
  const hasHierarchy = (a: ValidatedArea) => a.course !== "" && a.topic !== "" && a.topicArea !== "";

  return {
    areas,
    courses,
    issuesByArea,
    getAreaById: (id: string) =>
      typeof id === "string" && byId.has(id) ? byId.get(id) : undefined,
    getCourses: () => courses,
    getCourseById: (id: string) =>
      typeof id === "string" && courseById.has(id) ? courseById.get(id) : undefined,
    getCourseSlugs: () => distinctSorted(areas.filter(hasHierarchy).map((a) => a.course)),
    getTopics: (course) =>
      distinctSorted(areas.filter((a) => hasHierarchy(a) && a.course === course).map((a) => a.topic)),
    getTopicAreas: (course, topic) =>
      distinctSorted(
        areas
          .filter((a) => hasHierarchy(a) && a.course === course && a.topic === topic)
          .map((a) => a.topicArea),
      ),
    getAreasInTopic: (course, topic) =>
      areas
        .filter((a) => hasHierarchy(a) && a.course === course && a.topic === topic)
        .sort((a, b) => a.topicArea.localeCompare(b.topicArea)),
  };
}

/** Discover + load every area under /content via Vite glob, then build the
 * registry. Runtime entry point; the pure core is `buildAreaRegistry`. */
export function loadAllAreas(options: LoadOptions = {}): AreaRegistry {
  const files = import.meta.glob<unknown>("/content/**/*.json", {
    eager: true,
    import: "default",
  });
  return buildAreaRegistry(files, options);
}
