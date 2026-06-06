/** @file format.ts — small display helpers for the app shell. */

/** "expanding-brackets" → "Expanding Brackets". */
export function titleCase(slug: string): string {
  return slug
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** A topic-area route path for a lesson/hierarchy. */
export function areaPath(l: { subject: string; topic: string; topicArea: string }): string {
  return `/${l.subject}/${l.topic}/${l.topicArea}`;
}

/** Seconds → "m:ss". */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.max(0, Math.round(seconds % 60));
  return `${m}:${String(s).padStart(2, "0")}`;
}
