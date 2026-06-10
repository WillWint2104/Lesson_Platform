// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
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
  // KaTeX markup has no accessible role/text, so the .katex / .mathtext-* class
  // selectors are the appropriate assertions for the math-rendering path.
  it("renders a .katex node inside an inline span for inline math", () => {
    const { container } = render(<MathText>{"$x^2$"}</MathText>);
    expect(container.querySelector(".mathtext-inline .katex")).not.toBeNull();
  });

  it("renders display math in a block-level span", () => {
    const { container } = render(<MathText>{"$$x^2$$"}</MathText>);
    expect(container.querySelector(".mathtext-display .katex")).not.toBeNull();
  });

  it("renders plain text untouched (user-visible), with no katex node", () => {
    const { container } = render(<MathText>{"just words"}</MathText>);
    expect(screen.getByText("just words")).toBeTruthy();
    expect(container.querySelector(".katex")).toBeNull();
  });

  it("does not throw on malformed math (throwOnError: false)", () => {
    expect(() => render(<MathText>{"$\\frac{$"}</MathText>)).not.toThrow();
  });

  it("typesets the \\emA emphasis macro as a coloured KaTeX node, not literal text", () => {
    const { container } = render(<MathText>{"$\\emA{3}$"}</MathText>);
    expect(container.querySelector(".mathtext-inline .katex")).not.toBeNull();
    // The macro expands to a class-tagged span (mapped to a theme token in CSS).
    expect(container.querySelector(".katex .ktx-em-a")).not.toBeNull();
    // The VISIBLE (.katex-html) layer shows the argument, never the raw command.
    // (The MathML annotation legitimately carries the source TeX.)
    expect(container.querySelector(".katex-html")?.textContent ?? "").not.toContain("emA");
  });

  it("typesets the \\emB emphasis macro as a coloured KaTeX node", () => {
    const { container } = render(<MathText>{"$\\emB{x}$"}</MathText>);
    expect(container.querySelector(".katex .ktx-em-b")).not.toBeNull();
    expect(container.querySelector(".katex-html")?.textContent ?? "").not.toContain("emB");
  });
});

describe("MathText displayStyle (§13 readability addendum)", () => {
  it("prefixes \displaystyle on INLINE segments when displayStyle is set", () => {
    const { container } = render(<MathText displayStyle>{"Expand $\frac{1}{2}x$."}</MathText>);
    // KaTeX embeds the source TeX in the MathML annotation.
    expect(container.innerHTML).toContain("\displaystyle");
  });

  it("does NOT alter math by default (additive prop)", () => {
    const { container } = render(<MathText>{"Expand $\frac{1}{2}x$."}</MathText>);
    expect(container.innerHTML).not.toContain("\displaystyle");
  });

  it("leaves plain text and $$display$$ segments untouched", () => {
    const { container } = render(<MathText displayStyle>{"Rule: $$a(b+c)=ab+ac$$"}</MathText>);
    expect(container.textContent).toContain("Rule:");
    // Display segments already render in display mode; no prefix is injected.
    expect(container.innerHTML).not.toContain("\displaystyle");
  });
});
