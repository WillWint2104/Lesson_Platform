// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { VideoEmbed } from "@/render/VideoEmbed";

afterEach(cleanup);

const ID = "dQw4w9WgXcQ";

describe("VideoEmbed", () => {
  it("renders a privacy-friendly nocookie iframe for a valid source", () => {
    render(<VideoEmbed src={`https://youtu.be/${ID}`} title="Lesson video" />);
    const iframe = screen.getByTitle("Lesson video");
    expect(iframe.tagName).toBe("IFRAME");
    expect(iframe.getAttribute("src")).toBe(
      `https://www.youtube-nocookie.com/embed/${ID}?rel=0`,
    );
    expect(iframe.getAttribute("loading")).toBe("lazy");
    expect(iframe.hasAttribute("allowfullscreen")).toBe(true);
  });

  it("renders a coming-soon panel for a null source (not an error)", () => {
    const { container } = render(<VideoEmbed src={null} title="Lesson video" />);
    expect(container.querySelector(".video-stage__overlay")).not.toBeNull();
    expect(screen.getByText("Video coming soon.")).toBeTruthy();
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it("renders a role=alert error chip for an unparseable source (defence in depth)", () => {
    render(<VideoEmbed src="nope!!" title="Lesson video" />);
    expect(screen.getByRole("alert").textContent).toContain("nope!!");
  });
});
