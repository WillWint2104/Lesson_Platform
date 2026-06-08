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

  it("on completion links to the NEXT stage's video (Back to area on the last stage)", () => {
    const reg = buildReg(
      mkArea("brackets", {
        stages: [stage("A", { questions: [mcQuestion("q", "Y", "N")] }), stage("B")],
      }),
    );
    renderAt(EX1, reg, buildStore(reg));
    fireEvent.click(screen.getByRole("button", { name: "Y" }));
    const next = screen.getByRole("link", { name: /Next: Video 2/ });
    expect(next.getAttribute("href")).toBe(`/${AREA_ID}/stage/2`); // the next stage's (video) page
  });

  it("on the LAST stage, completion links back to the area instead", () => {
    const reg = buildReg(
      mkArea("brackets", { stages: [stage("Only", { questions: [mcQuestion("q", "Y", "N")] })] }),
    );
    renderAt(EX1, reg, buildStore(reg));
    fireEvent.click(screen.getByRole("button", { name: "Y" }));
    expect(screen.queryByText(/Next: Video/)).toBeNull();
    expect(screen.getByRole("link", { name: /Back to Brackets/ })).toBeTruthy();
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

  it("extra solutions are ALWAYS available, and extra never completes the stage", () => {
    const reg = buildReg(
      mkArea("brackets", {
        stages: [stage("S", { questions: [textQ("core")], extra: [mcQuestion("extra-q", "ER", "EW")] })],
      }),
    );
    const store = buildStore(reg);
    renderAt(EX1, reg, store);
    fireEvent.click(screen.getByRole("button", { name: /More practice/ }));
    // Extra solution is NOT locked, even with the core unanswered.
    const extraSolve = screen.getByRole("button", { name: "Show explanation for question M1" });
    expect((extraSolve as HTMLButtonElement).disabled).toBe(false);
    // Answering the extra question records to store.extra but does NOT complete.
    fireEvent.click(screen.getByRole("button", { name: "ER" }));
    expect(store.getStageProgress(AREA_ID, 0)?.extra[0]).toBe("correct");
    expect(store.getStageProgress(AREA_ID, 0)?.completedAt).toBeNull();
  });

  it("a row self-marks directly (✓ Got it) without opening the solution", () => {
    const reg = buildReg(
      mkArea("brackets", { stages: [stage("S", { questions: [textQ("q", "A")] })] }),
    );
    const store = buildStore(reg);
    renderAt(EX1, reg, store);
    fireEvent.click(screen.getByRole("button", { name: "Got it" }));
    expect(store.getStageProgress(AREA_ID, 0)?.core[0]).toBe("correct");
    expect(screen.queryByRole("dialog")).toBeNull(); // never opened a solution
    expect(screen.getByText(/Exercise 1 complete/)).toBeTruthy(); // single core → complete
  });

  it("the solution shows the working BEFORE the answer chip", () => {
    const reg = buildReg(
      mkArea("brackets", {
        stages: [
          stage("S", {
            questions: [{ type: "text", prompt: "q", answer: "FINAL", working: ["stepone", "steptwo"] }],
          }),
        ],
      }),
    );
    const { container } = renderAt(EX1, reg, buildStore(reg));
    fireEvent.click(screen.getByRole("button", { name: "Show solution for question 1" }));
    const working = container.querySelector(".qr-reveal__working")!;
    const answer = container.querySelector(".qr-reveal__answer")!;
    expect(working.compareDocumentPosition(answer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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

  it("is an in-place dialog over a blurred backdrop (not a route — the page stays mounted)", () => {
    const reg = buildReg(twoQ);
    const { container } = renderAt(EX1, reg, buildStore(reg));
    fireEvent.click(screen.getByRole("button", { name: "Enlarge question 1" }));
    const backdrop = container.querySelector(".focus-backdrop");
    expect(backdrop).not.toBeNull();
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(backdrop!.contains(dialog)).toBe(true);
    // the exercise page is still mounted behind the dialog (enlarge-in-place, not navigation)
    expect(container.querySelector(".ex-grid")).not.toBeNull();
  });

  it("self-marks from the focus view with the G and N keys (no solution needed)", () => {
    const reg = buildReg(twoQ);
    const store = buildStore(reg);
    renderAt(EX1, reg, store);
    fireEvent.click(screen.getByRole("button", { name: "Enlarge question 1" }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "g" });
    expect(store.getStageProgress(AREA_ID, 0)?.core[0]).toBe("correct");
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "n" });
    expect(store.getStageProgress(AREA_ID, 0)?.core[0]).toBe("incorrect");
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
    expect(c2.querySelector(".notes-cols")).not.toBeNull();
  });
});
