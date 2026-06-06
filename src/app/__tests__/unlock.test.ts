import { describe, it, expect } from "vitest";
import { computeSegmentUnlock, isAreaComplete, type SegmentInput } from "@/app/unlock";

const v: SegmentInput = { type: "video", complete: false };
const ex = (complete: boolean): SegmentInput => ({ type: "exercise", complete });
const statuses = (segs: SegmentInput[]) => computeSegmentUnlock(segs).map((s) => s.status);

describe("computeSegmentUnlock", () => {
  it("videos are always open", () => {
    expect(statuses([v, ex(false)])).toEqual(["video", "current"]);
  });

  it("first incomplete exercise is current; later exercises lock", () => {
    expect(statuses([ex(false), ex(false)])).toEqual(["current", "locked"]);
  });

  it("completed exercises are done; the next unlocked-incomplete is current", () => {
    expect(statuses([ex(true), ex(false)])).toEqual(["done", "current"]);
  });

  it("videos between exercises never block unlock", () => {
    expect(statuses([ex(true), v, ex(false), v])).toEqual(["done", "video", "current", "video"]);
  });

  it("all exercises done → all done (no current)", () => {
    expect(statuses([ex(true), v, ex(true)])).toEqual(["done", "video", "done"]);
  });

  it("reports unlocked (openable) for videos + done/current, not locked", () => {
    expect(computeSegmentUnlock([ex(true), ex(false), ex(false)]).map((s) => s.unlocked)).toEqual([
      true,
      true,
      false,
    ]);
  });
});

describe("isAreaComplete", () => {
  it("is true only when every exercise segment is complete", () => {
    expect(isAreaComplete([ex(true), v, ex(true)])).toBe(true);
    expect(isAreaComplete([ex(true), ex(false)])).toBe(false);
    expect(isAreaComplete([v])).toBe(false); // no exercises
  });
});
