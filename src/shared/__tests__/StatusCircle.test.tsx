// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { StatusCircle } from "@/shared/StatusCircle";

afterEach(cleanup);

describe("StatusCircle", () => {
  it("renders an icon variant with its class + accessible label (lucide smoke)", () => {
    const { container } = render(<StatusCircle variant="check" label="Done" />);
    const el = screen.getByRole("img", { name: "Done" });
    expect(el.className).toContain("status-circle--check");
    expect(el.className).toContain("status-circle--md"); // default size
    expect(container.querySelector("svg")).not.toBeNull(); // a lucide <svg> rendered
  });

  it("renders the number variant's value (no icon)", () => {
    const { container } = render(<StatusCircle variant="number" label="Upcoming" value={3} />);
    const el = screen.getByRole("img", { name: "Upcoming" });
    expect(el.textContent).toBe("3");
    expect(container.querySelector("svg")).toBeNull();
  });

  it.each(["check", "play-ring", "number", "lock", "dot"] as const)(
    "supports the %s variant",
    (variant) => {
      render(<StatusCircle variant={variant} label={variant} value={1} />);
      expect(screen.getByRole("img", { name: variant }).className).toContain(
        `status-circle--${variant}`,
      );
    },
  );

  it("applies the sm size and pressable depth only when asked", () => {
    render(<StatusCircle variant="lock" label="Locked" size="sm" pressable />);
    const el = screen.getByRole("img", { name: "Locked" });
    expect(el.className).toContain("status-circle--sm");
    expect(el.className).toContain("status-circle--pressable");
  });

  it("is flat (not pressable) by default — §1 informational indicator", () => {
    render(<StatusCircle variant="play-ring" label="Current" />);
    expect(screen.getByRole("img", { name: "Current" }).className).not.toContain("pressable");
  });
});
