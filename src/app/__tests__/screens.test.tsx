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
// v2 §8: exercise text questions carry a canonical answer (the equivalence
// check needs one). Default to "$x$" so areas built in tests are valid; pass an
// explicit answer where a test checks correctness.
const textQ = (prompt: string, answer = "$x$") => ({
  type: "text",
  prompt,
  answer,
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

  it("shows the breadcrumb + mastery % in the top bar on an area route (§7a)", () => {
    const reg = buildReg(mkArea("brackets", { title: "Brackets", stages: [stage("A"), stage("B")] }));
    const store = buildStore(reg);
    store.recordAttempt(AREA_ID, 0, true); // 1 of 2 stages → 50%
    renderAt(STAGE1, reg, store);
    const bar = screen.getByRole("banner");
    expect(within(bar).getByLabelText("Breadcrumb")).toBeTruthy(); // breadcrumb present
    expect(within(bar).getByText("Brackets")).toBeTruthy(); // area title (breadcrumb current)
    expect(within(bar).getByLabelText("50% mastery")).toBeTruthy();
  });

  it("hides the breadcrumb + mastery on the Library (no active area)", () => {
    const reg = buildReg(mkArea("brackets", { title: "Brackets" }));
    renderAt("/", reg, buildStore(reg));
    const bar = screen.getByRole("banner");
    expect(within(bar).queryByLabelText("Breadcrumb")).toBeNull(); // breadcrumb absent
    expect(within(bar).queryByText(/mastery/)).toBeNull();
  });
});

describe("Contents sidebar (shell, §4)", () => {
  it("renders on an area/stage route and links its items to the right routes", () => {
    const reg = buildReg(mkArea("brackets", { stages: [stage("Alpha"), stage("Beta")] }));
    renderAt(STAGE1, reg, buildStore(reg));
    const nav = screen.getByRole("navigation", { name: "Lesson contents" });
    expect(nav).toBeTruthy();
    expect(within(nav).getByRole("link", { name: "Stage 2 exercise" }).getAttribute("href")).toBe(
      `/${AREA_ID}/stage/2/exercise`,
    );
    // The active stage's video item is marked current.
    expect(
      within(nav).getByRole("link", { name: "Stage 1 video" }).getAttribute("aria-current"),
    ).toBe("page");
  });

  it("is absent on the Library (no active area) and on not-found", () => {
    const reg = buildReg(mkArea("brackets"));
    renderAt("/", reg, buildStore(reg));
    expect(screen.queryByRole("navigation", { name: "Lesson contents" })).toBeNull();
    cleanup();
    renderAt("/no/such/area", reg, buildStore(reg));
    expect(screen.queryByRole("navigation", { name: "Lesson contents" })).toBeNull();
  });
});

describe("Library", () => {
  it("carries the v2 home skin on its root (grid-canvas hub)", () => {
    const reg = buildReg(mkArea("brackets"));
    const { container } = renderAt("/", reg, buildStore(reg));
    expect(container.querySelector("main.lib.v2-home")).not.toBeNull();
  });

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

  it("puts the video band on its own row; notes split into rule | examples columns (§7a)", () => {
    const reg = buildReg(
      mkArea("brackets", {
        stages: [
          stage("S", {
            notes: [
              { type: "paragraph", text: "Rule prose." },
              { type: "callout", style: "key", text: "Remember me." },
              { type: "example", prompt: "Ex", answer: "$3$", steps: [{ tex: "3" }] },
            ],
            video: { src: null, duration: null },
          }),
        ],
      }),
    );
    const { container } = renderAt(STAGE1, reg, buildStore(reg));
    // Video band is a full-width panel, separate from the notes columns.
    expect(container.querySelector(".stage-v2__video")).not.toBeNull();
    const ruleCol = container.querySelector(".notes-cols__rule")! as HTMLElement;
    const examplesCol = container.querySelector(".notes-cols__examples")! as HTMLElement;
    expect(within(ruleCol).getByText("The rule")).toBeTruthy();
    expect(within(ruleCol).getByText("Remember")).toBeTruthy();
    expect(examplesCol.querySelector(".step-player")).not.toBeNull(); // worked examples in the right col
    expect(ruleCol.querySelector(".step-player")).toBeNull();
    // CTA lives in the "Up next" footer.
    expect(screen.getByRole("link", { name: /Start Exercise 1/ })).toBeTruthy();
  });

  it("not-found for an out-of-range stage number", () => {
    const reg = buildReg(mkArea("brackets"));
    renderAt(`/${AREA_ID}/stage/9`, reg, buildStore(reg));
    expect(screen.getByRole("heading", { name: "Not found" })).toBeTruthy();
  });

  it("navigates freely between stages via the contents sidebar (§4 is the nav)", () => {
    const reg = buildReg(mkArea("brackets", { stages: [stage("Alpha"), stage("Beta")] }));
    renderAt(STAGE1, reg, buildStore(reg));
    // Jump to stage 2 via the sidebar…
    fireEvent.click(
      within(screen.getByRole("navigation", { name: "Lesson contents" })).getByRole("link", {
        name: "Stage 2 video",
      }),
    );
    expect(screen.getByRole("link", { name: /Start Exercise 2/ })).toBeTruthy();
    // …and back to stage 1.
    fireEvent.click(
      within(screen.getByRole("navigation", { name: "Lesson contents" })).getByRole("link", {
        name: "Stage 1 video",
      }),
    );
    expect(screen.getByRole("link", { name: /Start Exercise 1/ })).toBeTruthy();
  });
});

describe("ExercisePage — completion & gating", () => {
  const EX1 = `/${AREA_ID}/stage/1/exercise`;

  /** Type an answer + click Check, scoped to a card/dialog (defaults to the page). */
  function answer(value: string, scope?: HTMLElement) {
    const root = scope ?? document.body;
    fireEvent.change(within(root).getByLabelText("Your answer"), { target: { value } });
    fireEvent.click(within(root).getByRole("button", { name: "Check" }));
  }

  it("marks a correct answer by algebraic equivalence (a reordering still passes)", () => {
    const reg = buildReg(
      mkArea("brackets", { stages: [stage("S", { questions: [textQ("Expand 4(x+3)", "$4x+12$")] })] }),
    );
    const store = buildStore(reg);
    renderAt(EX1, reg, store);
    answer("12 + 4x"); // reordered — equivalent
    expect(screen.getByText("Correct")).toBeTruthy();
    expect(store.getStageProgress(AREA_ID, 0)?.core[0]).toEqual({ answer: "12 + 4x", correct: true });
  });

  it("marks a wrong answer 'Incorrect' (no 'Try again') yet still completes the stage", () => {
    const reg = buildReg(
      mkArea("brackets", { stages: [stage("Only", { questions: [textQ("Expand", "$4x+12$")] })] }),
    );
    const store = buildStore(reg);
    renderAt(EX1, reg, store);
    expect(screen.queryByText(/Exercise 1 complete/)).toBeNull();
    answer("4x + 9"); // wrong
    expect(screen.getByText("Incorrect")).toBeTruthy();
    expect(screen.queryByText(/try again/i)).toBeNull();
    expect(screen.getByText(/Exercise 1 complete/)).toBeTruthy(); // answered → complete
    expect(screen.getByText(/marked Incorrect/)).toBeTruthy(); // nudge
    expect(store.getStageProgress(AREA_ID, 0)?.completedAt).not.toBeNull();
  });

  it("the Solution button is LOCKED until the question is answered (§8)", () => {
    const reg = buildReg(mkArea("brackets", { stages: [stage("S", { questions: [textQ("q", "$x+1$")] })] }));
    renderAt(EX1, reg, buildStore(reg));
    expect((screen.getByRole("button", { name: /Solution locked/ }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    answer("x+1");
    expect((screen.getByRole("button", { name: "Solution" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("the solution shows the working BEFORE the answer", () => {
    const reg = buildReg(
      mkArea("brackets", {
        stages: [
          stage("S", {
            questions: [{ type: "text", prompt: "q", answer: "$x+1$", working: ["stepone", "steptwo"] }],
          }),
        ],
      }),
    );
    const { container } = renderAt(EX1, reg, buildStore(reg));
    answer("x+1");
    fireEvent.click(screen.getByRole("button", { name: "Solution" }));
    const working = container.querySelector(".qr-reveal__working")!;
    const ans = container.querySelector(".qr-reveal__answer")!;
    expect(working.compareDocumentPosition(ans) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("on completion links to the NEXT stage's video; Back to area on the last stage", () => {
    const reg = buildReg(
      mkArea("brackets", { stages: [stage("A", { questions: [textQ("q", "$x$")] }), stage("B")] }),
    );
    renderAt(EX1, reg, buildStore(reg));
    answer("x");
    expect(screen.getByRole("link", { name: /Next: Video 2/ }).getAttribute("href")).toBe(
      `/${AREA_ID}/stage/2`,
    );

    cleanup();
    const last = buildReg(mkArea("brackets", { stages: [stage("Only", { questions: [textQ("q", "$x$")] })] }));
    renderAt(EX1, last, buildStore(last));
    answer("x");
    expect(screen.queryByText(/Next: Video/)).toBeNull();
    expect(screen.getByRole("link", { name: /Back to Brackets/ })).toBeTruthy();
  });

  it("more-practice expander is collapsed by default and reveals the extra cards", () => {
    const reg = buildReg(
      mkArea("brackets", {
        stages: [stage("S", { questions: [textQ("core", "$x$")], extra: [textQ("extra-q", "$y$")] })],
      }),
    );
    renderAt(EX1, reg, buildStore(reg));
    expect(screen.queryByRole("button", { name: "Enlarge practice question 1" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /More practice/ }));
    expect(screen.getByRole("button", { name: "Enlarge practice question 1" })).toBeTruthy();
  });

  it("extra records to store.extra but NEVER completes the stage", () => {
    const reg = buildReg(
      mkArea("brackets", {
        stages: [stage("S", { questions: [textQ("core", "$x$")], extra: [textQ("extra-q", "$y$")] })],
      }),
    );
    const store = buildStore(reg);
    renderAt(EX1, reg, store);
    fireEvent.click(screen.getByRole("button", { name: /More practice/ }));
    const extraCard = screen
      .getByRole("button", { name: "Enlarge practice question 1" })
      .closest("li") as HTMLElement;
    answer("y", extraCard);
    expect(store.getStageProgress(AREA_ID, 0)?.extra[0]).toEqual({ answer: "y", correct: true });
    expect(store.getStageProgress(AREA_ID, 0)?.completedAt).toBeNull(); // extra never completes
  });

  it("restores the recorded answer + sticky completedAt across a remount (no re-check)", () => {
    const reg = buildReg(mkArea("brackets", { stages: [stage("S", { questions: [textQ("q", "$x$")] })] }));
    const store = buildStore(reg);
    renderAt(EX1, reg, store);
    answer("zzz"); // wrong
    expect(store.getStageProgress(AREA_ID, 0)?.completedAt).not.toBeNull();
    cleanup();
    renderAt(EX1, reg, store);
    expect(screen.getByText("Incorrect")).toBeTruthy(); // result restored
    expect(screen.queryByLabelText("Your answer")).toBeNull(); // no field → no retake
  });

  it("never renders the difficulty tag in the student UI (§8)", () => {
    const reg = buildReg(
      mkArea("brackets", {
        stages: [stage("S", { questions: [{ type: "text", prompt: "q", answer: "$x$", difficulty: "hard" }] })],
      }),
    );
    const { container } = renderAt(EX1, reg, buildStore(reg));
    expect(container.querySelector(".qr-difficulty")).toBeNull();
    expect(screen.queryByText(/hard/i)).toBeNull();
  });
});

describe("Question focus view (§7c)", () => {
  const EX1 = `/${AREA_ID}/stage/1/exercise`;
  const twoQ = mkArea("brackets", {
    stages: [stage("S", { questions: [textQ("first q", "$a$"), textQ("second q", "$b$")] })],
  });
  const enlarge = (n = 1) =>
    fireEvent.click(screen.getByRole("button", { name: `Enlarge question ${n}` }));

  it("opens from the enlarge icon, labels Question N of M, navigates, closes (Esc), restores focus", () => {
    const reg = buildReg(twoQ);
    renderAt(EX1, reg, buildStore(reg));
    const opener = screen.getByRole("button", { name: "Enlarge question 1" });
    fireEvent.click(opener);
    const dialog = screen.getByRole("dialog", { name: "Question 1 of 2" });
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    expect(screen.getByRole("dialog", { name: "Question 2 of 2" })).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener); // focus restored to the opener
  });

  it("is an in-place dialog over a blurred scrim (the worksheet stays mounted, not a route)", () => {
    const reg = buildReg(twoQ);
    const { container } = renderAt(EX1, reg, buildStore(reg));
    enlarge(1);
    const backdrop = container.querySelector(".focus-backdrop");
    expect(backdrop).not.toBeNull();
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(backdrop!.contains(dialog)).toBe(true);
    expect(container.querySelector(".ws-panel")).not.toBeNull(); // worksheet still mounted
  });

  it("answering inside the focus view records the result and shows the bar", () => {
    const reg = buildReg(twoQ);
    const store = buildStore(reg);
    renderAt(EX1, reg, store);
    enlarge(1);
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Your answer"), { target: { value: "a" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Check" }));
    expect(within(dialog).getByText("Correct")).toBeTruthy();
    expect(store.getStageProgress(AREA_ID, 0)?.core[0]).toEqual({ answer: "a", correct: true });
  });

  it("CRITICAL: the solution stays locked until THAT question is answered, even via prev/next", () => {
    const reg = buildReg(twoQ);
    renderAt(EX1, reg, buildStore(reg));
    enlarge(1);
    let dialog = screen.getByRole("dialog");
    // q1 unanswered → S does nothing; the Solution button is locked.
    fireEvent.keyDown(dialog, { key: "s" });
    expect(within(dialog).queryByText(/Worked solution/)).toBeNull();
    expect(
      (within(dialog).getByRole("button", { name: /Solution locked/ }) as HTMLButtonElement).disabled,
    ).toBe(true);
    // Answer q1 → its solution unlocks.
    fireEvent.change(within(dialog).getByLabelText("Your answer"), { target: { value: "a" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Check" }));
    fireEvent.keyDown(dialog, { key: "s" });
    expect(within(dialog).getByText(/Worked solution/)).toBeTruthy();
    // Navigate to q2 (unanswered): the solution is NOT carried over, and S is inert.
    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByText(/Worked solution/)).toBeNull();
    fireEvent.keyDown(dialog, { key: "s" });
    expect(within(dialog).queryByText(/Worked solution/)).toBeNull(); // still locked for q2
  });

  it("MC renders inline inside the focus view", () => {
    const reg = buildReg(
      mkArea("brackets", { stages: [stage("S", { questions: [mcQuestion("pick", "Yes", "No")] })] }),
    );
    const store = buildStore(reg);
    renderAt(EX1, reg, store);
    enlarge(1);
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Yes" }));
    expect(store.getStageProgress(AREA_ID, 0)?.core[0]?.correct).toBe(true);
  });

  it("the exercise worksheet + stage notes expose stacking containers (mobile smoke)", () => {
    const reg = buildReg(mkArea("brackets"));
    const { container } = renderAt(EX1, reg, buildStore(reg));
    expect(container.querySelector(".qgrid")).not.toBeNull();
    cleanup();
    const { container: c2 } = renderAt(STAGE1, reg, buildStore(reg));
    expect(c2.querySelector(".notes-cols")).not.toBeNull();
  });
});
