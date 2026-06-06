// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { resolveFigureRenderer } from "@/render/figures/registry";
import { FigureSlot } from "@/render/figures/FigureSlot";
import { validTriangleData } from "@/render/figures/kinds/triangle-figure/fixtures";

afterEach(cleanup);

describe("registry dispatch (no cross-kind fallback)", () => {
  it("resolves implemented kinds", () => {
    expect(resolveFigureRenderer("triangle-figure", 1).status).toBe("ok");
    expect(resolveFigureRenderer("bearing-diagram", 1).status).toBe("ok");
  });

  it("resolves a known-but-unimplemented kind to not-implemented", () => {
    expect(resolveFigureRenderer("function-graph", 1).status).toBe("not-implemented");
  });

  it("resolves an unknown kind to unknown", () => {
    expect(resolveFigureRenderer("banana", 1).status).toBe("unknown");
  });

  it("never falls back across specVersions", () => {
    // triangle-figure exists at v1 only; v2 is not-implemented, NOT v1.
    expect(resolveFigureRenderer("triangle-figure", 2).status).toBe("not-implemented");
  });
});

describe("FigureSlot rendering", () => {
  it("renders an implemented kind into an SVG canvas", () => {
    const { container } = render(
      <FigureSlot figure={{ kind: "triangle-figure", specVersion: 1, data: validTriangleData }} />,
    );
    expect(container.querySelector(".figure-canvas")).not.toBeNull();
  });

  it("renders a placeholder for not-implemented kinds (distinct from the error chip)", () => {
    const { container } = render(
      <FigureSlot figure={{ kind: "function-graph", specVersion: 1, data: {} }} />,
    );
    expect(container.querySelector(".qr-figure")).not.toBeNull();
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it("renders a role=alert error chip naming an unknown kind", () => {
    render(<FigureSlot figure={{ kind: "banana", specVersion: 1, data: {} }} />);
    expect(screen.getByRole("alert").textContent).toContain("banana");
  });
});
