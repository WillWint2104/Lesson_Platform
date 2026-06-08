// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { GridCanvas, Panel, Card, Button, ResultBar } from "@/shared/v2";

afterEach(cleanup);

describe("GridCanvas", () => {
  it("renders the canvas class and can be a semantic element", () => {
    const { container } = render(
      <GridCanvas as="main">
        <span>x</span>
      </GridCanvas>,
    );
    const root = container.querySelector("main.v2-canvas");
    expect(root).not.toBeNull();
    expect(root!.textContent).toBe("x");
  });
});

describe("Panel (§4: white surface + 8px mint strip)", () => {
  it("always renders the mint strip above a padded body", () => {
    const { container } = render(<Panel>content</Panel>);
    const panel = container.querySelector(".v2-panel")!;
    const strip = panel.querySelector(".v2-panel__strip")!;
    const body = panel.querySelector(".v2-panel__body")!;
    expect(strip).not.toBeNull();
    expect(strip.getAttribute("aria-hidden")).toBe("true"); // decorative chrome
    expect(body.textContent).toBe("content");
    // strip precedes the body
    expect(strip.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("bodyless skips the padded body wrapper but keeps the strip", () => {
    const { container } = render(
      <Panel bodyless>
        <div className="custom">x</div>
      </Panel>,
    );
    expect(container.querySelector(".v2-panel__strip")).not.toBeNull();
    expect(container.querySelector(".v2-panel__body")).toBeNull();
    expect(container.querySelector(".v2-panel .custom")).not.toBeNull();
  });
});

describe("Card", () => {
  it("renders the card class with content", () => {
    const { container } = render(<Card className="x">hi</Card>);
    const card = container.querySelector(".v2-card.x")!;
    expect(card.textContent).toBe("hi");
  });
});

describe("Button (§5 shape, §2.5 grey-only-disabled)", () => {
  it("defaults to a primary button", () => {
    const { container } = render(<Button>Go</Button>);
    const btn = container.querySelector("button")!;
    expect(btn.className).toContain("v2-btn--primary");
    expect(btn.getAttribute("type")).toBe("button");
  });

  it("supports the ghost variant and the native disabled state", () => {
    const { container } = render(
      <Button variant="ghost" disabled>
        Locked
      </Button>,
    );
    const btn = container.querySelector("button")! as HTMLButtonElement;
    expect(btn.className).toContain("v2-btn--ghost");
    expect(btn.disabled).toBe(true); // grey comes from the shared :disabled rule
  });
});

describe("ResultBar (§7d)", () => {
  it("correct shows a check + 'Correct' + the answer in the answer slot", () => {
    const { container, getByText } = render(<ResultBar state="correct" answer="4x + 12" />);
    const bar = container.querySelector(".v2-result--correct")!;
    expect(bar).not.toBeNull();
    expect(getByText("Correct")).toBeTruthy();
    expect(container.querySelector(".v2-result__mark svg")).not.toBeNull();
    expect(container.querySelector(".v2-result__answer")!.textContent).toBe("4x + 12");
  });

  it("incorrect shows a cross + the exact label 'Incorrect' (no 'Try again')", () => {
    const { container, getByText, queryByText } = render(<ResultBar state="incorrect" answer="x" />);
    expect(container.querySelector(".v2-result--incorrect")).not.toBeNull();
    expect(getByText("Incorrect")).toBeTruthy();
    expect(queryByText(/try again/i)).toBeNull();
  });
});
