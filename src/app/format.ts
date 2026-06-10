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
export function areaPath(l: { course: string; topic: string; topicArea: string }): string {
  return `/${l.course}/${l.topic}/${l.topicArea}`;
}

/** Seconds → "m:ss". Rounds total seconds first so 59.6 → "1:00", not "0:60". */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
