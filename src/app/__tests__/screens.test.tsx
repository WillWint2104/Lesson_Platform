// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { buildAreaRegistry, type AreaRegistry } from "@/ingest/load";
import { createProgressStore, type ProgressStore } from "@/state/progress";
import { createMemoryBackend } from "@/state/storage";
import { RegistryProvider } from "@/app/RegistryContext";
import { ProgressProvider } from "@/state/ProgressContext";
import { AppRoutes } from "@/app/AppRoutes";

afterEach(cleanup);

const exercise = (title: string, right: string, wrong: string) => ({
  type: "exercise",
  title,
  questions: [
    {
      type: "multiple-choice",
      prompt: title,
      options: [
        { text: right, isCorrect: true },
        { text: wrong, isCorrect: false },
      ],
    },
  ],
});

function mkArea(topicArea: string, opts: { title?: string; sequence?: unknown[] } = {}) {
  return {
    [`/content/math/algebra/${topicArea}/area.json`]: {
      area: {
        title: opts.title ?? topicArea,
        notes: [{ type: "heading", text: "Notes heading" }],
        sequence:
          opts.sequence ?? [
            { type: "video", title: "Intro", src: null },
            exercise("Practice", "Right", "Wrong"),
          ],
      },
    },
  };
}

function buildReg(...areas: Record<string, unknown>[]): AreaRegistry {
  return buildAreaRegistry(Object.assign({}, ...areas));
}
function buildStore(reg: AreaRegistry): ProgressStore {
  return createProgressStore({ backend: createMemoryBackend(), areaIds: reg.areas.map((a) => a.id) });
}
function renderAt(path: string, reg: AreaRegistry, store: ProgressStore) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <RegistryProvider registry={reg}>
        <ProgressProvider store={store}>
          <AppRoutes />
        </ProgressProvider>
      </RegistryProvider>
    </MemoryRouter>,
  );
}

describe("Library", () => {
  it("renders registry-driven subject pills + a 'more soon' pill", () => {
    const reg = buildReg(mkArea("brackets"));
    renderAt("/", reg, buildStore(reg));
    expect(screen.getByRole("button", { name: "Math" })).toBeTruthy();
    expect(screen.getByText("more soon")).toBeTruthy();
  });

  it("shows the local-progress notice once and persists dismissal", () => {
    const reg = buildReg(mkArea("brackets"));
    const store = buildStore(reg);
    renderAt("/", reg, store);
    expect(screen.getByText(/saved in this browser/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText(/saved in this browser/i)).toBeNull();
    expect(store.isNoticeDismissed("local-progress")).toBe(true);
  });

  it("hero is 'start here' (always present) with no last-visited area", () => {
    const reg = buildReg(mkArea("brackets", { title: "Brackets" }));
    renderAt("/", reg, buildStore(reg));
    expect(screen.getByText("Start here")).toBeTruthy();
    expect(screen.getByText("Start here").closest("a")?.getAttribute("href")).toBe(
      "/math/algebra/brackets",
    );
  });

  it("hero is 'continue' when an area was last visited", () => {
    const reg = buildReg(mkArea("brackets", { title: "Brackets" }));
    const store = buildStore(reg);
    store.setLastVisited("math/algebra/brackets");
    renderAt("/", reg, store);
    expect(screen.getByText("Continue where you left off")).toBeTruthy();
    expect(
      screen.getByText("Continue where you left off").closest("a")?.getAttribute("href"),
    ).toBe("/math/algebra/brackets");
  });

  it("renders topic-area rows linking to the area page, + grid + placeholder", () => {
    const reg = buildReg(mkArea("brackets"));
    const { container } = renderAt("/", reg, buildStore(reg));
    const row = screen.getByText("Brackets").closest("a");
    expect(row?.getAttribute("href")).toBe("/math/algebra/brackets");
    expect(row?.className).toContain("topic-area-row");
    expect(container.querySelector(".topic-grid")).not.toBeNull();
    expect(screen.getByText(/Future topics drop in/)).toBeTruthy();
  });
});

describe("AreaPage", () => {
  it("renders notes + the sequence (video stage + first exercise runner)", () => {
    const reg = buildReg(mkArea("brackets"));
    renderAt("/math/algebra/brackets", reg, buildStore(reg));
    expect(screen.getByRole("heading", { name: "Notes" })).toBeTruthy();
    expect(screen.getByText("Video coming soon.")).toBeTruthy(); // null-src video stage
    expect(screen.getByRole("button", { name: "Right" })).toBeTruthy(); // exercise runner
  });

  it("renders not-found for an unknown area", () => {
    const reg = buildReg(mkArea("brackets"));
    renderAt("/no/such/area", reg, buildStore(reg));
    expect(screen.getByRole("heading", { name: "Not found" })).toBeTruthy();
  });

  it("locks a later exercise until the previous one is complete, then unlocks it", () => {
    const reg = buildReg(
      mkArea("brackets", {
        sequence: [exercise("First", "R0", "W0"), exercise("Second", "R1", "W1")],
      }),
    );
    renderAt("/math/algebra/brackets", reg, buildStore(reg));

    // First exercise is current; second is locked.
    expect(screen.getByRole("button", { name: "R0" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "R1" })).toBeNull();
    expect(screen.getByText(/Complete the previous exercise/)).toBeTruthy();

    // Complete the first exercise → the second unlocks.
    fireEvent.click(screen.getByRole("button", { name: "R0" }));
    fireEvent.click(screen.getByRole("button", { name: "Finish" }));
    expect(screen.getByRole("button", { name: "R1" })).toBeTruthy();
  });
});
