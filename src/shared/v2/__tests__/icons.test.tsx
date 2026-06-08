// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { V2_ICONS, CheckIcon } from "@/shared/v2/icons";

afterEach(cleanup);

// Emoji / pictographic ranges — the v2 icon set must contain NONE (§5).
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/u;

describe("v2 icon set (§5: inline SVG, never emoji)", () => {
  const names = Object.keys(V2_ICONS) as (keyof typeof V2_ICONS)[];

  it("exposes the full canonical set", () => {
    expect(names.sort()).toEqual(
      ["check", "chevron-left", "chevron-right", "close", "cross", "expand", "lock", "plus", "solution"].sort(),
    );
  });

  it.each(names)("%s renders inline SVG with currentColor and no emoji", (name) => {
    const Icon = V2_ICONS[name];
    const { container } = render(<Icon />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute("stroke")).toBe("currentColor");
    // Decorative by default.
    expect(svg!.getAttribute("aria-hidden")).toBe("true");
    // No text/emoji anywhere in the rendered output.
    expect(EMOJI.test(container.textContent ?? "")).toBe(false);
    expect((container.textContent ?? "").trim()).toBe("");
  });

  it("promotes to a labelled image when a title is given", () => {
    const { container, getByTitle } = render(<CheckIcon title="Correct" />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("role")).toBe("img");
    expect(svg.getAttribute("aria-label")).toBe("Correct");
    expect(svg.getAttribute("aria-hidden")).toBeNull();
    expect(getByTitle("Correct")).toBeTruthy();
  });
});
