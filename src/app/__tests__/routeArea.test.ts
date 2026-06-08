import { describe, it, expect } from "vitest";
import { parseAreaRoute } from "@/app/routeArea";

describe("parseAreaRoute", () => {
  it("returns null for non-area routes", () => {
    expect(parseAreaRoute("/")).toBeNull();
    expect(parseAreaRoute("/debug")).toBeNull();
    expect(parseAreaRoute("/a/b")).toBeNull();
  });

  it("parses the area root (no active item)", () => {
    expect(parseAreaRoute("/math/algebra/brackets")).toEqual({ areaId: "math/algebra/brackets" });
  });

  it("parses a stage route as the video view", () => {
    expect(parseAreaRoute("/math/algebra/brackets/stage/2")).toEqual({
      areaId: "math/algebra/brackets",
      stageNumber: 2,
      view: "video",
    });
  });

  it("parses a stage exercise route as the exercise view", () => {
    expect(parseAreaRoute("/math/algebra/brackets/stage/3/exercise")).toEqual({
      areaId: "math/algebra/brackets",
      stageNumber: 3,
      view: "exercise",
    });
  });

  it("rejects a non-integer / malformed stage tail", () => {
    expect(parseAreaRoute("/a/b/c/stage/x")).toBeNull();
    expect(parseAreaRoute("/a/b/c/stage/0")).toBeNull();
    expect(parseAreaRoute("/a/b/c/stage/2/nope")).toBeNull();
    expect(parseAreaRoute("/a/b/c/lesson/2")).toBeNull();
  });
});
