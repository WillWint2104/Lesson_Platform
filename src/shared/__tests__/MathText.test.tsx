// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { segmentMath, MathText } from "@/shared/MathText";

afterEach(cleanup);

describe("segmentMath", () => {
  it("returns an empty array for an empty string", () => {
    expect(segmentMath("")).toEqual([]);
  });

  it("returns a single text segment when there is no math", () => {
    expect(segmentMath("hello world")).toEqual([{ type: "text", value: "hello world" }]);
  });

  it("parses an inline segment", () => {
    expect(segmentMath("$x^2$")).toEqual([{ type: "inline", value: "x^2" }]);
  });

  it("parses a display segment ($$ wins over $)", () => {
    expect(segmentMath("$$x^2$$")).toEqual([{ type: "display", value: "x^2" }]);
  });

  it("parses mixed text and inline math", () => {
    expect(segmentMath("a $x$ b")).toEqual([
      { type: "text", value: "a " },
      { type: "inline", value: "x" },
      { type: "text", value: " b" },
    ]);
  });

  it("parses adjacent inline segments", () => {
    expect(segmentMath("$a$$b$")).toEqual([
      { type: "inline", value: "a" },
      { type: "inline", value: "b" },
    ]);
  });

  it("treats an unclosed delimiter as literal text", () => {
    expect(segmentMath("cost is $5 for one")).toEqual([
      { type: "text", value: "cost is $5 for one" },
    ]);
  });

  it("treats an unclosed delimiter after a valid segment as literal text", () => {
    expect(segmentMath("$x$ then $oops")).toEqual([
      { type: "inline", value: "x" },
      { type: "text", value: " then $oops" },
    ]);
  });
});

describe("MathText", () => {
  it("renders a .katex node inside an inline span for inline math", () => {
    const { container } = render(<MathText>{"$x^2$"}</MathText>);
    expect(container.querySelector(".mathtext-inline")).not.toBeNull();
    expect(container.querySelector(".katex")).not.toBeNull();
  });

  it("renders display math in a block container", () => {
    const { container } = render(<MathText>{"$$x^2$$"}</MathText>);
    expect(container.querySelector(".mathtext-display")).not.toBeNull();
    expect(container.querySelector(".katex")).not.toBeNull();
  });

  it("renders plain text untouched, with no katex node", () => {
    const { container } = render(<MathText>{"just words"}</MathText>);
    expect(container.textContent).toBe("just words");
    expect(container.querySelector(".katex")).toBeNull();
  });

  it("does not throw on malformed math (throwOnError: false)", () => {
    expect(() => render(<MathText>{"$\\frac{$"}</MathText>)).not.toThrow();
  });
});
