// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { StepPlayer } from "@/render/notes/StepPlayer";

afterEach(cleanup);

describe("StepPlayer", () => {
  it("reveals steps one at a time, then the answer", () => {
    // `tex` is typeset by KaTeX (so emphasis macros work); assert structurally.
    const { container } = render(
      <StepPlayer examples={[{ prompt: "P", answer: "ANS", steps: [{ tex: "x=1" }, { tex: "x=2" }] }]} />,
    );
    expect(container.querySelectorAll(".example__step--revealed")).toHaveLength(1);
    expect(container.querySelectorAll(".example__step--ghost")).toHaveLength(1);
    expect(screen.queryByText("ANS")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Next step/ }));
    expect(container.querySelectorAll(".example__step--revealed")).toHaveLength(2);
    expect(container.querySelectorAll(".example__step--ghost")).toHaveLength(0);
    expect(screen.getByText("ANS")).toBeTruthy(); // final step → answer chip
    expect(screen.queryByRole("button", { name: /Next step/ })).toBeNull();
  });

  it("a why? toggle expands the explanation", () => {
    render(
      <StepPlayer examples={[{ prompt: "P", answer: "A", steps: [{ tex: "x", why: "because reasons" }] }]} />,
    );
    expect(screen.queryByText("because reasons")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "why?" }));
    expect(screen.getByText("because reasons")).toBeTruthy();
  });

  it("tabs switch between examples and reset the reveal state", () => {
    render(
      <StepPlayer
        examples={[
          { prompt: "prompt-A", answer: "a", steps: [{ tex: "a1" }] },
          { prompt: "prompt-B", answer: "b", steps: [{ tex: "b1" }] },
        ]}
      />,
    );
    expect(screen.getByText("prompt-A")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Example 2" }));
    expect(screen.getByText("prompt-B")).toBeTruthy();
    expect(screen.queryByText("prompt-A")).toBeNull();
  });

  it("legacy working renders fully revealed (no step player)", () => {
    render(<StepPlayer examples={[{ prompt: "P", answer: "ANS", working: ["w1", "w2"] }]} />);
    expect(screen.getByText("w1")).toBeTruthy();
    expect(screen.getByText("w2")).toBeTruthy();
    expect(screen.getByText("ANS")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Next step/ })).toBeNull();
  });
});
