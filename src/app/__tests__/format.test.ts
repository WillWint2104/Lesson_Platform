import { describe, it, expect } from "vitest";
import { titleCase, areaPath, formatDuration } from "@/app/format";

describe("titleCase", () => {
  it("title-cases slugs", () => {
    expect(titleCase("expanding-brackets")).toBe("Expanding Brackets");
    expect(titleCase("math")).toBe("Math");
  });
});

describe("areaPath", () => {
  it("builds a topic-area route", () => {
    expect(areaPath({ course: "math", topic: "algebra", topicArea: "brackets" })).toBe(
      "/math/algebra/brackets",
    );
  });
});

describe("formatDuration", () => {
  it("formats m:ss", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(600)).toBe("10:00");
  });

  it("rounds total seconds first (no 0:60 rollover)", () => {
    expect(formatDuration(59.6)).toBe("1:00");
    expect(formatDuration(119.7)).toBe("2:00");
  });

  it("clamps negatives to zero", () => {
    expect(formatDuration(-5)).toBe("0:00");
  });
});
