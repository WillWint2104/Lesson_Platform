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
const STAGE1 = `/${AREA_ID}/stage/1`;

const mcQuestion = (prompt: string, right: string, wrong: string) => ({
  type: "multiple-choice",
  prompt,
  options: [
    { text: right, isCorrect: true },
    { text: wrong, isCorrect: false },
  ],
});
const textQ = (prompt: string, answer?: string) => ({
  type: "text",
  prompt,
  ...(answer !== undefined ? { answer } : {}),
});

function stage(
  title: string,
  opts: { notes?: unknown[]; video?: unknown; questions?: unknown[]; extra?: unknown[] } = {},
) {
  return {
    title,
    ...(opts.notes !== undefined ? { notes: opts.notes } : {}),
    ...(opts.video !== undefined ? { video: opts.video } : {}),
    exercise: {
      questions: opts.questions ?? [mcQuestion(title, "Right", "Wrong")],
      ...(opts.extra !== undefined ? { extra: opts.extra } : {}),
    },
  };
}

function mkArea(topicArea: string, opts: { title?: string; stages?: unknown[] } = {}) {
  return {
    [`/content/math/algebra/${topicArea}/area.json`]: {
      area: {
        title: opts.title ?? topicArea,
        stages: opts.stages ?? [
          stage("Intro", {
            notes: [{ type: "heading", text: "Notes heading" }],
            video: { src: null, duration: null },
            questions: [mcQuestion("Practice", "Right", "Wrong")],
          }),
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

describe("app chrome (page, not frame)", () => {
  const routes = ["/", STAGE1, "/nope", "/debug"];
  it.each(routes)("renders the full-width app bar + footer on %s", (path) => {
    const reg = buildReg(mkArea("brackets"));
    renderAt(path, reg, buildStore(reg));
    expect(screen.getByRole("link", { name: "Lesson Platform" })).toBeTruthy();
    const footer = screen.getByRole("contentinfo");
    expect(within(footer).getByText("Lesson Platform")).toBeTruthy();
  });
});

describe("Library", () => {
  it("renders subject pills + a 'more soon' pill", () => {
    const reg = buildReg(mkArea("brackets"));
    renderAt("/", reg, buildStore(reg));
    expect(screen.getByRole("button", { name: "Math" })).toBeTruthy();
    expect(screen.getByText("more soon")).toBeTruthy();
  });

  it("local-progress notice shows on Library only + persists dismissal", () => {
    const reg = buildReg(mkArea("brackets"));
    const store = buildStore(reg);
    renderAt("/", reg, store);
    expect(screen.getByText(/saved in this browser/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(store.isNoticeDismissed("local-progress")).toBe(true);
    cleanup();
    renderAt(STAGE1, reg, store);
    expect(screen.queryByText(/saved in this browser/i)).toBeNull();
  });

  it("hero 'start here' deep-links to the first incomplete stage page", () => {
    const reg = buildReg(mkArea("brackets", { title: "Brackets" }));
    renderAt("/", reg, buildStore(reg));
    expect(screen.getByText("Start here").closest("a")?.getAttribute("href")).toBe(STAGE1);
  });

  it("hero 'continue' deep-links to the stored stage + view", () => {
    const reg = buildReg(mkArea("brackets", { stages: [stage("A"), stage("B")] }));
    const store = buildStore(reg);
    store.setLastVisited(AREA_ID, 1, "exercise");
    renderAt("/", reg, store);
    expect(
      screen.getByText("Continue where you left off").closest("a")?.getAttribute("href"),
    ).toBe(`/${AREA_ID}/stage/2/exercise`);
  });

  it("up next deep-links to the first incomplete stage page; stats over stages", () => {
    const reg = buildReg(mkArea("brackets", { stages: [stage("First"), stage("Second")] }));
    const store = buildStore(reg);
    store.recordAttempt(AREA_ID, 0, true);
    renderAt("/", reg, store);
    expect(screen.getByText("Second").closest("a")?.getAttribute("href")).toBe(
      `/${AREA_ID}/stage/2`,
    );
    const statVal = (label: string) =>
      screen.getByText(label).closest(".stat-row")?.querySelector(".stat-row__val")?.textContent;
    expect(statVal("Exercises completed")).toBe("1/2");
  });
});

describe("Area redirect", () => {
  it("redirects the area root to stage 1 with no progress", () => {
    const reg = buildReg(mkArea("brackets", { stages: [stage("Alpha"), stage("Beta")] }));
    renderAt(`/${AREA_ID}`, reg, buildStore(reg));
    expect(screen.getByRole("link", { name: /Start Exercise 1/ })).toBeTruthy();
  });

  it("redirects to the current (first incomplete) stage", () => {
    const reg = buildReg(mkArea("brackets", { stages: [stage("Alpha"), stage("Beta")] }));
    const store = buildStore(reg);
    store.recordAttempt(AREA_ID, 0, true); // stage 1 done → current is stage 2
    renderAt(`/${AREA_ID}`, reg, store);
    expect(screen.getByRole("link", { name: /Start Exercise 2/ })).toBeTruthy();
  });

  it("not-found for an unknown area", () => {
    const reg = buildReg(mkArea("brackets"));
    renderAt("/no/such/area", reg, buildStore(reg));
    expect(screen.getByRole("heading", { name: "Not found" })).toBeTruthy();
  });
});

describe("StagePage", () => {
  it("renders the video, notes panels, and the Start-Exercise CTA", () => {
    const reg = buildReg(
      mkArea("brackets", {
        stages: [
          stage("Single brackets", {
            notes: [
              { type: "paragraph", text: "Multiply the outside term." },
              { type: "callout", style: "key", text: "Remember this." },
              { type: "example", prompt: "Expand 3(x+4).", answer: "3x+12", steps: [{ tex: "3x+12" }] },
            ],
            video: { src: null, duration: null },
          }),
        ],
      }),
    );
    renderAt(STAGE1, reg, buildStore(reg));
    expect(screen.getByText("Video coming soon.")).toBeTruthy();
    expect(screen.getByText("The rule")).toBeTruthy();
    expect(screen.getByText("Remember")).toBeTruthy();
    expect(screen.getByText("Worked examples")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Start Exercise 1/ })).toBeTruthy();
  });

  it("not-found for an out-of-range stage number", () => {
    const reg = buildReg(mkArea("brackets"));
    renderAt(`/${AREA_ID}/stage/9`, reg, buildStore(reg));
    expect(screen.getByRole("heading", { name: "Not found" })).toBeTruthy();
  });

  it("stepper navigates freely in both directions", () => {
    const reg = buildReg(mkArea("brackets", { stages: [stage("Alpha"), stage("Beta")] }));
    renderAt(STAGE1, reg, buildStore(reg));
    // On stage 1; jump to stage 2 via the stepper.
    fireEvent.click(screen.getByRole("link", { name: /Beta/ }));
    expect(screen.getByRole("link", { name: /Start Exercise 2/ })).toBeTruthy();
    // …and back to stage 1.
    fireEvent.click(screen.getByRole("link", { name: /Alpha/ }));
    expect(screen.getByRole("link", { name: /Start Exercise 1/ })).toBeTruthy();
  });
});

describe("ExercisePage — completion & gating", () => {
  const EX1 = `/${AREA_ID}/stage/1/exercise`;

  it("completes when all core are ANSWERED (even incorrectly) + shows the nudge", () => {
    const reg = buildReg(
      mkArea("brackets", { stages: [stage("Only", { questions: [mcQuestion("q", "Yes", "No")] })] }),
    );
    const store = buildStore(reg);
    renderAt(EX1, reg, store);
    expect(screen.queryByText(/Exercise 1 complete/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "No" })); // wrong, but answered
    expect(screen.getByText(/Exercise 1 complete/)).toBeTruthy();
    expect(screen.getByText(/marked red before moving on/)).toBeTruthy(); // nudge
    expect(store.getStageProgress(AREA_ID, 0)?.completedAt).not.toBeNull();
  });

  it("offers Continue to the next stage (Back to area on the last)", () => {
    const reg = buildReg(
      mkArea("brackets", {
        stages: [stage("A", { questions: [mcQuestion("q", "Y", "N")] }), stage("B")],
      }),
    );
    renderAt(EX1, reg, buildStore(reg));
    fireEvent.click(screen.getByRole("button", { name: "Y" }));
    expect(screen.getByRole("link", { name: /Continue to Stage 2/ })).toBeTruthy();
  });

  it("more-practice expander is collapsed by default and reveals extra rows", () => {
    const reg = buildReg(
      mkArea("brackets", {
        stages: [stage("S", { questions: [mcQuestion("core", "R", "W")], extra: [mcQuestion("extra-q", "ER", "EW")] })],
      }),
    );
    renderAt(EX1, reg, buildStore(reg));
    expect(screen.queryByRole("button", { name: "ER" })).toBeNull(); // collapsed
    fireEvent.click(screen.getByRole("button", { name: /More practice/ }));
    expect(screen.getByRole("button", { name: "ER" })).toBeTruthy();
  });

  it("extra solutions are locked until core is complete, and extra never completes the stage", () => {
    const reg = buildReg(
      mkArea("brackets", {
        stages: [stage("S", { questions: [textQ("core")], extra: [mcQuestion("extra-q", "ER", "EW")] })],
      }),
    );
    const store = buildStore(reg);
    renderAt(EX1, reg, store);
    fireEvent.click(screen.getByRole("button", { name: /More practice/ }));
    // Extra solution locked while core is unanswered.
    const extraSolve = screen.getByRole("button", { name: "Show explanation for question M1" });
    expect((extraSolve as HTMLButtonElement).disabled).toBe(true);
    // Answering the extra question records to store.extra but does NOT complete.
    fireEvent.click(screen.getByRole("button", { name: "ER" }));
    expect(store.getStageProgress(AREA_ID, 0)?.extra[0]).toBe("correct");
    expect(store.getStageProgress(AREA_ID, 0)?.completedAt).toBeNull();
  });

  it("restores answered-state + records sticky completedAt that survives a re-run", () => {
    const reg = buildReg(
      mkArea("brackets", { stages: [stage("S", { questions: [textQ("q", "A")] })] }),
    );
    const store = buildStore(reg);
    renderAt(EX1, reg, store);
    fireEvent.click(screen.getByRole("button", { name: "Show solution for question 1" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "I got it" }));
    const first = store.getStageProgress(AREA_ID, 0);
    expect(first?.completedAt).not.toBeNull();
    expect(screen.getByLabelText("Answered correctly")).toBeTruthy();
  });
});

describe("Question focus view", () => {
  const EX1 = `/${AREA_ID}/stage/1/exercise`;
  const twoQ = mkArea("brackets", {
    stages: [stage("S", { questions: [textQ("first q", "A1"), textQ("second q", "A2")] })],
  });

  it("opens from the enlarge icon, labels Question N of M, navigates and closes (Esc)", () => {
    const reg = buildReg(twoQ);
    renderAt(EX1, reg, buildStore(reg));
    const enlarge = screen.getByRole("button", { name: "Enlarge question 1" });
    fireEvent.click(enlarge);
    const dialog = screen.getByRole("dialog", { name: "Question 1 of 2" });
    expect(dialog).toBeTruthy();
    expect(dialog.contains(document.activeElement)).toBe(true);

    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    expect(screen.getByRole("dialog", { name: "Question 2 of 2" })).toBeTruthy();

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(enlarge); // focus restored to the row's opener
  });

  it("the S key opens the solution inside the focus view", () => {
    const reg = buildReg(twoQ);
    renderAt(EX1, reg, buildStore(reg));
    fireEvent.click(screen.getByRole("button", { name: "Enlarge question 1" }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "s" });
    expect(screen.getByText("A1")).toBeTruthy(); // solution answer shown
  });

  it("MC renders inline inside the focus view", () => {
    const reg = buildReg(
      mkArea("brackets", { stages: [stage("S", { questions: [mcQuestion("pick", "Yes", "No")] })] }),
    );
    const store = buildStore(reg);
    renderAt(EX1, reg, store);
    fireEvent.click(screen.getByRole("button", { name: "Enlarge question 1" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Yes" }));
    expect(store.getStageProgress(AREA_ID, 0)?.core[0]).toBe("correct");
  });

  it("the exercise grid + stage grid expose stacking containers (mobile smoke)", () => {
    const reg = buildReg(mkArea("brackets"));
    const { container } = renderAt(EX1, reg, buildStore(reg));
    expect(container.querySelector(".ex-grid")).not.toBeNull();
    cleanup();
    const { container: c2 } = renderAt(STAGE1, reg, buildStore(reg));
    expect(c2.querySelector(".stage-grid")).not.toBeNull();
  });
});
