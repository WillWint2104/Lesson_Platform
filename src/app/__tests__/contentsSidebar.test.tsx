// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { buildAreaRegistry } from "@/ingest/load";
import { createProgressStore, type ProgressStore } from "@/state/progress";
import { createMemoryBackend } from "@/state/storage";
import { ContentsSidebar } from "@/app/ContentsSidebar";

afterEach(cleanup);

const AREA_ID = "math/algebra/brackets";

function build() {
  const reg = buildAreaRegistry({
    [`/content/${AREA_ID}/area.json`]: {
      area: {
        title: "Expanding Brackets",
        stages: [
          {
            title: "single brackets",
            video: { src: null, duration: 6 },
            exercise: { questions: [{ type: "text", prompt: "q1", answer: "a" }] },
          },
          {
            title: "negative factors",
            exercise: {
              questions: [
                { type: "text", prompt: "q1", answer: "a" },
                { type: "text", prompt: "q2", answer: "a" },
              ],
            },
          },
        ],
      },
    },
  });
  const area = reg.getAreaById(AREA_ID)!;
  const store: ProgressStore = createProgressStore({
    backend: createMemoryBackend(),
    areaIds: reg.areas.map((a) => a.id),
  });
  return { area, store };
}

function renderSidebar(props: Partial<Parameters<typeof ContentsSidebar>[0]> = {}) {
  const { area, store } = build();
  return {
    store,
    ...render(
      <MemoryRouter>
        <ContentsSidebar area={area} store={store} {...props} />
      </MemoryRouter>,
    ),
  };
}

describe("ContentsSidebar (§4)", () => {
  it("renders the unit title and a stage group per stage, with Video + Exercise items", () => {
    renderSidebar();
    const nav = screen.getByRole("navigation", { name: "Lesson contents" });
    expect(within(nav).getByText("Expanding Brackets")).toBeTruthy();
    // Title-cased stage labels (non-links).
    expect(within(nav).getByText(/Single Brackets/)).toBeTruthy();
    expect(within(nav).getByText(/Negative Factors/)).toBeTruthy();
    // Two items per stage, linking to the right routes.
    expect(screen.getByRole("link", { name: "Stage 1 video" }).getAttribute("href")).toBe(
      `/${AREA_ID}/stage/1`,
    );
    expect(screen.getByRole("link", { name: "Stage 1 exercise" }).getAttribute("href")).toBe(
      `/${AREA_ID}/stage/1/exercise`,
    );
    expect(screen.getByRole("link", { name: "Stage 2 exercise" }).getAttribute("href")).toBe(
      `/${AREA_ID}/stage/2/exercise`,
    );
  });

  it("shows the video duration and the question count as item meta", () => {
    renderSidebar();
    const video1 = screen.getByRole("link", { name: "Stage 1 video" });
    expect(within(video1).getByText("6 min")).toBeTruthy();
    const ex2 = screen.getByRole("link", { name: "Stage 2 exercise" });
    expect(within(ex2).getByText("2 Q")).toBeTruthy();
  });

  it("marks the active item with aria-current=page", () => {
    renderSidebar({ activeStage: 1, activeView: "exercise" });
    const active = screen.getByRole("link", { name: "Stage 1 exercise" });
    expect(active.getAttribute("aria-current")).toBe("page");
    expect(active.className).toContain("cs-item--active");
    // The sibling video item is NOT active.
    expect(
      screen.getByRole("link", { name: "Stage 1 video" }).getAttribute("aria-current"),
    ).toBeNull();
  });

  it("shows 0% progress before any stage is complete", () => {
    renderSidebar();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("0");
  });

  it("reflects completion in the progress bar and the stage status", () => {
    const { area, store } = build();
    store.recordAttempt(AREA_ID, 0, true); // complete stage 1 → 1 of 2 = 50%
    render(
      <MemoryRouter>
        <ContentsSidebar area={area} store={store} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("50");
    const video1 = screen.getByRole("link", { name: "Stage 1 video" });
    expect(within(video1).getByRole("img", { name: "completed" })).toBeTruthy();
  });
});
