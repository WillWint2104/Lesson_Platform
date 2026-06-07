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

import type { NoteBlock, Question, Stage } from "./types";
import {
  validateAreaManifest,
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
  /** areaId = `<subject>/<topic>/<topicArea>` (path-derived, unique). */
  id: string;
  title: string;
  /** Hierarchy derived from the directory path (CLAUDE.md §a), not the manifest. */
  subject: string;
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
  subject: string;
  topic: string;
  topicArea: string;
}

const EXPECTED_PATH_SHAPE = "/content/<subject>/<topic>/<topic-area>/area.json";

/** Derive { subject, topic, topicArea } from a `.../area.json` path, or null. */
function deriveAreaHierarchy(manifestPath: string): AreaHierarchy | null {
  const marker = "/content/";
  const start = manifestPath.indexOf(marker);
  if (start === -1) return null;
  const segments = manifestPath.slice(start + marker.length).split("/");
  // [subject, topic, topicArea, "area.json"]
  if (segments.length !== 4 || segments[3] !== "area.json") return null;
  const [subject, topic, topicArea] = segments;
  if (!subject || !topic || !topicArea) return null;
  return { subject, topic, topicArea };
}

export interface AreaRegistry {
  areas: ValidatedArea[];
  issuesByArea: Record<string, { errors: Issue[]; warnings: Issue[] }>;
  /** Stale-ID-safe lookup: returns undefined for unknown ids (never throws). */
  getAreaById: (id: string) => ValidatedArea | undefined;
  getSubjects: () => string[];
  getTopics: (subject: string) => string[];
  /** Distinct topic-area names within a topic, alphabetical. */
  getTopicAreas: (subject: string, topic: string) => string[];
  /** Areas within a topic, sorted by topic-area name. */
  getAreasInTopic: (subject: string, topic: string) => ValidatedArea[];
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
      ? `${hierarchy.subject}/${hierarchy.topic}/${hierarchy.topicArea}`
      : manifestPath;

    if (seenIds.has(id)) {
      errors.push({ path: "area", message: `duplicate area id '${id}'` });
    }
    seenIds.add(id);

    const title = typeof area?.["title"] === "string" ? (area["title"] as string) : "";

    areas.push({
      id,
      title,
      subject: hierarchy?.subject ?? "",
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

  const distinctSorted = (values: string[]) => Array.from(new Set(values)).sort();

  return {
    areas,
    issuesByArea,
    getAreaById: (id: string) =>
      typeof id === "string" && byId.has(id) ? byId.get(id) : undefined,
    getSubjects: () => distinctSorted(areas.map((a) => a.subject)),
    getTopics: (subject) =>
      distinctSorted(areas.filter((a) => a.subject === subject).map((a) => a.topic)),
    getTopicAreas: (subject, topic) =>
      distinctSorted(
        areas.filter((a) => a.subject === subject && a.topic === topic).map((a) => a.topicArea),
      ),
    getAreasInTopic: (subject, topic) =>
      areas
        .filter((a) => a.subject === subject && a.topic === topic)
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
