/**
 * @file load.ts — Area discovery + loading (CLAUDE.md §a, §c rule 7).
 *
 * Discovers `area.json` manifests under /content, resolves area notes and each
 * exercise segment's questions (inline or a referenced file path), normalises
 * video sources + figures, runs the validator, and returns every area WITH its
 * issues. Invalid areas are returned, not dropped and not thrown. A stray
 * superseded `lesson.json` is surfaced as an invalid area carrying the migration
 * error.
 *
 * Discovery: Vite's `import.meta.glob('/content/**' + '/*.json', { eager: true })`.
 * The pure core (`buildAreaRegistry`) takes the path->json map so it is
 * unit-testable without Vite.
 */

import type { AreaSegment, NoteBlock, Question } from "./types";
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

/** A resolved segment: questions inlined, video src normalised to an id/null. */
export type ResolvedSegment =
  | { type: "video"; title: string; src: string | null }
  | { type: "exercise"; title: string; questions: Question[] };

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
  notes: NoteBlock[];
  segments: ResolvedSegment[];
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

    const dir = dirOf(manifestPath);

    // Resolve area notes (inline array or referenced file).
    let notes: NoteBlock[] = [];
    const notesField = area?.["notes"];
    if (typeof notesField === "string") {
      const notesPath = dir + notesField.replace(/^\.\//, "");
      if (notesPath in files) {
        const notesRaw = files[notesPath];
        const nres = validateNotesFile(notesRaw);
        errors.push(...prefixIssues(nres.errors, notesPath));
        warnings.push(...prefixIssues(nres.warnings, notesPath));
        notes = asArray<NoteBlock>((notesRaw as { notes?: unknown } | null)?.notes);
      } else {
        errors.push({ path: "area.notes", message: `referenced notes file not found: ${notesPath}` });
      }
    } else {
      notes = asArray<NoteBlock>(notesField);
    }

    // Resolve the ordered sequence into segments.
    const segments: ResolvedSegment[] = [];
    const rawSequence = asArray<AreaSegment>(area?.["sequence"]);
    rawSequence.forEach((segRaw, i) => {
      const seg = segRaw as unknown as Record<string, unknown>;
      const segPath = `area.sequence[${i}]`;
      const title = typeof seg["title"] === "string" ? (seg["title"] as string) : "";
      if (seg["type"] === "video") {
        const src = typeof seg["src"] === "string" ? parseYouTubeId(seg["src"] as string) : null;
        segments.push({ type: "video", title, src });
      } else if (seg["type"] === "exercise") {
        let questions: Question[] = [];
        const qField = seg["questions"];
        if (typeof qField === "string") {
          const qPath = dir + qField.replace(/^\.\//, "");
          if (qPath in files) {
            const qRaw = files[qPath];
            const qres = validateQuestionsFile(qRaw, { figureSchemas });
            errors.push(...prefixIssues(qres.errors, qPath));
            warnings.push(...prefixIssues(qres.warnings, qPath));
            questions = normalizeFigures(asArray<Question>((qRaw as { questions?: unknown } | null)?.questions));
            if (questions.length === 0) {
              errors.push({ path: `${segPath} (exercise)`, message: "exercise must contain at least one question" });
            }
          } else {
            errors.push({ path: `${segPath} (exercise)`, message: `referenced questions file not found: ${qPath}` });
          }
        } else {
          questions = normalizeFigures(asArray<Question>(qField));
        }
        segments.push({ type: "exercise", title, questions });
      }
      // Unknown segment types are already reported by the validator; skip here.
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
      notes,
      segments,
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

/** Exercise-segment indices of an area (for completion + unlock). */
export function exerciseSegmentIndices(area: ValidatedArea): number[] {
  return area.segments
    .map((s, i) => (s.type === "exercise" ? i : -1))
    .filter((i) => i >= 0);
}
