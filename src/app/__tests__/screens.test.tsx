// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { buildAreaRegistry, type AreaRegistry } from "@/ingest/load";
import { createProgressStore, type ProgressStore } from "@/state/progress";
import { createMemoryBackend } from "@/state/storage";
import { RegistryProvider } from "@/app/RegistryContext";
import { ProgressProvider } from "@/state/ProgressContext";
import { AppRoutes } from "@/app/AppRoutes";

afterEach(cleanup);

const AREA_ID = "math/algebra/brackets";

const mcQuestion = (prompt: string, right: string, wrong: string) => ({
  type: "multiple-choice",
  prompt,
  options: [
    { text: right, isCorrect: true },
    { text: wrong, isCorrect: false },
  ],
});
const mcExercise = (title: string, right: string, wrong: string) => ({
  type: "exercise",
  title,
  questions: [mcQuestion(title, right, wrong)],
});
const video = (title: string, src: string | null = null) => ({ type: "video", title, src });
const textQ = (prompt: string, answer?: string, working?: string[]) => ({
  type: "text",
  prompt,
  ...(answer !== undefined ? { answer } : {}),
  ...(working !== undefined ? { working } : {}),
});

function mkArea(topicArea: string, opts: { title?: string; sequence?: unknown[] } = {}) {
  return {
    [`/content/math/algebra/${topicArea}/area.json`]: {
      area: {
        title: opts.title ?? topicArea,
        notes: [{ type: "heading", text: "Notes heading" }],
        sequence: opts.sequence ?? [video("Intro"), mcExercise("Practice", "Right", "Wrong")],
      },
    },
  };
}

function buildReg(...areas: Record<string, unknown>[]): AreaRegistry {
  return buildAreaRegistry(Object.assign({}, ...areas));
}
function buildStore(reg: AreaRegistry): ProgressStore {
  return createProgressStore({
    backend: createMemoryBackend(),
    areaIds: reg.areas.map((a) => a.id),
  });
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

describe("app chrome (page, not frame)", () => {
  const routes = ["/", `/${AREA_ID}`, "/nope", "/debug"];
  it.each(routes)("renders the full-width app bar + footer on %s", (path) => {
    const reg = buildReg(mkArea("brackets"));
    renderAt(path, reg, buildStore(reg));
    // Accessible, user-facing queries: getByRole/getByText exclude a11y-hidden
    // nodes and throw if the chrome isn't rendered — not presence-only checks.
    expect(screen.getByRole("link", { name: "Lesson Platform" })).toBeTruthy(); // app bar wordmark
    const footer = screen.getByRole("contentinfo"); // the <footer> landmark
    expect(within(footer).getByText("Lesson Platform")).toBeTruthy(); // footer wordmark
    expect(within(footer).getByText(/©/)).toBeTruthy();
  });

  it("adds the page-surface body-class hook", () => {
    const reg = buildReg(mkArea("brackets"));
    renderAt("/", reg, buildStore(reg));
    expect(document.body.classList.contains("lp-app")).toBe(true);
  });
});

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

  it("hero is 'start here' (always present), deep-linking to the first incomplete exercise", () => {
    const reg = buildReg(mkArea("brackets", { title: "Brackets" }));
    renderAt("/", reg, buildStore(reg));
    expect(screen.getByText("Start here")).toBeTruthy();
    expect(screen.getByText("Start here").closest("a")?.getAttribute("href")).toBe(
      "/math/algebra/brackets#exercise-1",
    );
  });

  it("hero is 'continue' when an area was last visited", () => {
    const reg = buildReg(mkArea("brackets", { title: "Brackets" }));
    const store = buildStore(reg);
    store.setLastVisited(AREA_ID);
    renderAt("/", reg, store);
    expect(screen.getByText("Continue where you left off")).toBeTruthy();
    expect(
      screen.getByText("Continue where you left off").closest("a")?.getAttribute("href"),
    ).toBe("/math/algebra/brackets#exercise-1");
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

describe("AreaPage — layout", () => {
  it("renders the notes section, a video stage, and the worksheet", () => {
    const reg = buildReg(mkArea("brackets"));
    renderAt(`/${AREA_ID}`, reg, buildStore(reg));
    expect(screen.getByRole("heading", { name: "Notes" })).toBeTruthy();
    expect(screen.getByText("Video coming soon.")).toBeTruthy(); // null-src video stage
    expect(screen.getByRole("button", { name: "Right" })).toBeTruthy(); // inline MC option
  });

  it("renders not-found for an unknown area", () => {
    const reg = buildReg(mkArea("brackets"));
    renderAt("/no/such/area", reg, buildStore(reg));
    expect(screen.getByRole("heading", { name: "Not found" })).toBeTruthy();
  });

  it("numbers videos and exercises independently, in authored order", () => {
    const reg = buildReg(
      mkArea("brackets", {
        sequence: [
          video("V-A"),
          mcExercise("E-A", "r0", "w0"),
          video("V-B"),
          mcExercise("E-B", "r1", "w1"),
        ],
      }),
    );
    renderAt(`/${AREA_ID}`, reg, buildStore(reg));
    expect(screen.getByRole("heading", { name: "Video 1 · V-A" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Exercise 1 · E-A" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Video 2 · V-B" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Exercise 2 · E-B" })).toBeTruthy();
  });

  it("numbers the questions within an exercise 1..n", () => {
    const reg = buildReg(
      mkArea("brackets", {
        sequence: [
          {
            type: "exercise",
            title: "Three",
            questions: [mcQuestion("Q-one", "a", "b"), textQ("Q-two"), textQ("Q-three")],
          },
        ],
      }),
    );
    const { container } = renderAt(`/${AREA_ID}`, reg, buildStore(reg));
    const nums = Array.from(container.querySelectorAll(".ws-row__num")).map((n) => n.textContent);
    expect(nums).toEqual(["1", "2", "3"]);
  });
});

describe("AreaPage — solution modal", () => {
  it("opens a worked-solution modal, moves focus in, closes on Escape, returns focus", () => {
    const reg = buildReg(
      mkArea("brackets", {
        sequence: [
          {
            type: "exercise",
            title: "T",
            questions: [textQ("Solve it", "Answer here", ["First step", "Second step"])],
          },
        ],
      }),
    );
    renderAt(`/${AREA_ID}`, reg, buildStore(reg));
    const icon = screen.getByRole("button", { name: "Show solution for question 1" });

    fireEvent.click(icon);
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.contains(document.activeElement)).toBe(true); // focus moved in
    expect(within(dialog).getByText("Answer here")).toBeTruthy();
    expect(within(dialog).getByText("First step")).toBeTruthy();
    expect(within(dialog).getByText("Second step")).toBeTruthy();

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(icon); // focus returned to the opener
  });

  it("closes on a backdrop click", () => {
    const reg = buildReg(
      mkArea("brackets", {
        sequence: [{ type: "exercise", title: "T", questions: [textQ("Solve", "A")] }],
      }),
    );
    const { container } = renderAt(`/${AREA_ID}`, reg, buildStore(reg));
    fireEvent.click(screen.getByRole("button", { name: "Show solution for question 1" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.mouseDown(container.querySelector(".modal-backdrop")!);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows an honest empty state when there is no worked solution", () => {
    const reg = buildReg(
      mkArea("brackets", {
        sequence: [{ type: "exercise", title: "T", questions: [textQ("No solution here")] }],
      }),
    );
    renderAt(`/${AREA_ID}`, reg, buildStore(reg));
    fireEvent.click(screen.getByRole("button", { name: "Show solution for question 1" }));
    expect(screen.getByText("No worked solution provided.")).toBeTruthy();
  });

  it("MC: marks inline, then opens an explanation-only modal (no self-mark)", () => {
    const reg = buildReg(mkArea("brackets")); // [video, mc("Practice","Right","Wrong")]
    const store = buildStore(reg);
    const { container } = renderAt(`/${AREA_ID}`, reg, store);

    fireEvent.click(screen.getByRole("button", { name: "Right" })); // correct, inline
    expect(container.querySelector(".ws-row__status--correct")).not.toBeNull();
    expect(store.getExerciseProgress(AREA_ID, 1)?.questionOutcomes[0]).toBe("correct");

    fireEvent.click(screen.getByRole("button", { name: "Show explanation for question 1" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByRole("button", { name: "I got it" })).toBeNull();
    expect(within(dialog).queryByRole("button", { name: "Not yet" })).toBeNull();
    expect(dialog.querySelector(".qr-mc__option--correct")).not.toBeNull();
  });

  it("non-MC: self-mark records the outcome and closes the modal", () => {
    const reg = buildReg(
      mkArea("brackets", {
        sequence: [{ type: "exercise", title: "T", questions: [textQ("Solve", "A")] }],
      }),
    );
    const store = buildStore(reg);
    const { container } = renderAt(`/${AREA_ID}`, reg, store);

    fireEvent.click(screen.getByRole("button", { name: "Show solution for question 1" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "I got it" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(store.getExerciseProgress(AREA_ID, 0)?.questionOutcomes[0]).toBe("correct");
    expect(container.querySelector(".ws-row__status--correct")).not.toBeNull();
  });
});

describe("AreaPage — progress & gating", () => {
  it("restores the answered-state indicator from the store on load", () => {
    const reg = buildReg(mkArea("brackets")); // exercise is segment index 1
    const store = buildStore(reg);
    store.recordOutcome(AREA_ID, 1, 0, "correct");
    const { container } = renderAt(`/${AREA_ID}`, reg, store);
    expect(container.querySelector(".ws-row__status--correct")).not.toBeNull();
  });

  it("locks a later exercise (hiding its questions), then unlocks on completion", () => {
    const reg = buildReg(
      mkArea("brackets", {
        sequence: [mcExercise("First", "R0", "W0"), mcExercise("Second", "R1", "W1")],
      }),
    );
    renderAt(`/${AREA_ID}`, reg, buildStore(reg));

    // First is current; second is locked and its question is NOT rendered.
    expect(screen.getByRole("button", { name: "R0" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "R1" })).toBeNull();
    expect(screen.getByText(/Finish Exercise 1 first/)).toBeTruthy();

    // Completing the first (all correct) unlocks the second.
    fireEvent.click(screen.getByRole("button", { name: "R0" }));
    expect(screen.getByRole("button", { name: "R1" })).toBeTruthy();
    expect(screen.queryByText(/Finish Exercise 1 first/)).toBeNull();
  });

  it("increments attempts on each re-completion but keeps completedAt sticky", () => {
    const reg = buildReg(
      mkArea("brackets", {
        sequence: [{ type: "exercise", title: "T", questions: [textQ("Solve", "A")] }],
      }),
    );
    const store = buildStore(reg);
    renderAt(`/${AREA_ID}`, reg, store);
    const openModal = () =>
      fireEvent.click(screen.getByRole("button", { name: "Show solution for question 1" }));

    openModal();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "I got it" }));
    const first = store.getExerciseProgress(AREA_ID, 0);
    expect(first?.attempts).toBe(1);
    expect(first?.completedAt).not.toBeNull();

    // Break "all correct", then re-complete → a fresh attempt, same completedAt.
    openModal();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Not yet" }));
    openModal();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "I got it" }));
    const second = store.getExerciseProgress(AREA_ID, 0);
    expect(second?.attempts).toBe(2);
    expect(second?.completedAt).toBe(first?.completedAt);
  });

  it("shows the area-complete banner once every exercise is complete", () => {
    const reg = buildReg(
      mkArea("brackets", { sequence: [mcExercise("Only", "Yes", "No")] }),
    );
    renderAt(`/${AREA_ID}`, reg, buildStore(reg));
    expect(screen.queryByText(/completed every exercise/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    expect(screen.getByText(/completed every exercise/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to library" })).toBeTruthy();
  });

  it("hero deep-link anchor target exists on the area page", () => {
    const reg = buildReg(mkArea("brackets", { title: "Brackets" }));
    const store = buildStore(reg);
    renderAt("/", reg, store);
    const href = screen.getByText("Start here").closest("a")?.getAttribute("href");
    expect(href).toContain("#exercise-1");
    cleanup();

    const { container } = renderAt(`/${AREA_ID}`, reg, store);
    expect(container.querySelector("#exercise-1")).not.toBeNull();
  });
});
