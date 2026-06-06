/**
 * @file youtube.ts — the ONE YouTube id resolver (CLAUDE.md §c rule 4).
 *
 * Both the manifest validator and <VideoEmbed> parse `video.src` through this
 * pure function — no second, drifting implementation. Accepts:
 *   - a full youtube.com/watch?v=<id> URL
 *   - a youtu.be/<id> short link
 *   - a youtube.com/embed/<id> (or youtube-nocookie) URL
 *   - a bare 11-character video id
 * Returns the 11-char id, or null when `src` is not parseable.
 */

/** YouTube video ids are exactly 11 chars of [A-Za-z0-9_-]. */
const ID_RE = /^[A-Za-z0-9_-]{11}$/;

/** Human-readable list of accepted formats, for validator error messages. */
export const ACCEPTED_YOUTUBE_FORMATS =
  "a youtube.com/watch?v=… URL, a youtu.be/… short link, a youtube.com/embed/… URL, or a bare 11-character video id";

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
]);

function validId(candidate: string | null | undefined): string | null {
  return candidate && ID_RE.test(candidate) ? candidate : null;
}

export function parseYouTubeId(src: unknown): string | null {
  if (typeof src !== "string") return null;
  const s = src.trim();
  if (!s) return null;

  // Bare id.
  if (ID_RE.test(s)) return s;

  let url: URL;
  try {
    url = new URL(s);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const host = url.hostname.replace(/^www\./i, "").toLowerCase();

  if (host === "youtu.be") {
    return validId(url.pathname.slice(1).split("/")[0]);
  }

  if (YOUTUBE_HOSTS.has(host)) {
    if (url.pathname === "/watch") {
      return validId(url.searchParams.get("v"));
    }
    const embed = url.pathname.match(/^\/embed\/([^/?#]+)/);
    if (embed) return validId(embed[1]);
  }

  return null;
}
