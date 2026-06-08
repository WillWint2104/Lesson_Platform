/**
 * @file routeArea.ts — parse the active area/stage out of a pathname (pure).
 *
 * The AppShell is a layout route, so it can't read `:subject/:topic/:topicArea`
 * via useParams (those match on child routes). The contents sidebar instead
 * derives the active area from the location pathname. Kept pure + exported so it
 * is unit-testable without a router.
 *
 * Recognised shapes (segments after the leading slash):
 *   [s, t, a]                          → area root (sidebar shown, no active item)
 *   [s, t, a, "stage", n]              → a stage (video view active)
 *   [s, t, a, "stage", n, "exercise"]  → a stage exercise (exercise view active)
 */
export type AreaView = "video" | "exercise";

export interface ActiveAreaRoute {
  areaId: string;
  /** 1-based stage number when on a stage route; undefined at the area root. */
  stageNumber?: number;
  /** Which item is active on a stage route. */
  view?: AreaView;
}

export function parseAreaRoute(pathname: string): ActiveAreaRoute | null {
  const seg = pathname.split("/").filter(Boolean);
  if (seg.length < 3) return null; // "/" , "/debug", etc.
  const [subject, topic, topicArea] = seg;
  const areaId = `${subject}/${topic}/${topicArea}`;

  if (seg.length === 3) return { areaId };

  // Anything beyond the area root must be the stage shape, or it's not an area route.
  if (seg[3] !== "stage") return null;
  const stageNumber = Number(seg[4]);
  if (!Number.isInteger(stageNumber) || stageNumber < 1) return null;

  if (seg.length === 5) return { areaId, stageNumber, view: "video" };
  if (seg.length === 6 && seg[5] === "exercise") {
    return { areaId, stageNumber, view: "exercise" };
  }
  return null;
}
