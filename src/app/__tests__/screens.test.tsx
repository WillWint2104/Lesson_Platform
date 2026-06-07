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
const textQ = (prompt: string, answer?: string, working?: string[]) => ({
  type: "text",
  prompt,
  ...(answer !== undefined ? { answer } : {}),
  ...(working !== undefined ? { working } : {}),
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
    expect(screen.getByRole("link", { name: "Lesson Platform" })).toBeTruthy();
    const footer = screen.getByRole("contentinfo");
    expect(within(footer).getByText("Lesson Platform")).toBeTruthy();
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

  it("shows the local-progress notice on the Library only (not other routes)", () => {
    const reg = buildReg(mkArea("brackets"));
    renderAt(`/${AREA_ID}`, reg, buildStore(reg));
    expect(screen.queryByText(/saved in this browser/i)).toBeNull();
  });

  it("hero is 'start here', deep-linking to the first incomplete stage", () => {
    const reg = buildReg(mkArea("brackets", { title: "Brackets" }));
    renderAt("/", reg, buildStore(reg));
    expect(screen.getByText("Start here")).toBeTruthy();
    expect(screen.getByText("Start here").closest("a")?.getAttribute("href")).toBe(
      "/math/algebra/brackets#stage-1",
    );
  });

  it("hero is 'continue' when an area was last visited", () => {
    const reg = buildReg(mkArea("brackets", { title: "Brackets" }));
    const store = buildStore(reg);
    store.setLastVisited(AREA_ID, 0, "stage");
    renderAt("/", reg, store);
    expect(screen.getByText("Continue where you left off")).toBeTruthy();
    expect(
      screen.getByText("Continue where you left off").closest("a")?.getAttribute("href"),
    ).toBe("/math/algebra/brackets#stage-1");
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

describe("Hub rail (zones)", () => {
  const statVal = (label: string) =>
    screen.getByText(label).closest(".stat-row")?.querySelector(".stat-row__val")?.textContent;

  it("renders the zoned hub: main + rail with all three rail cards", () => {
    const reg = buildReg(mkArea("brackets"));
    const { container } = renderAt("/", reg, buildStore(reg));
    expect(container.querySelector(".hub")).not.toBeNull();
    expect(container.querySelector(".hub__main")).not.toBeNull();
    expect(container.querySelector(".hub__rail")).not.toBeNull();
    expect(screen.getByText("Up next")).toBeTruthy();
    expect(screen.getByText("Your progress")).toBeTruthy();
    expect(screen.getByText("How it works")).toBeTruthy();
  });

  it("up next: first incomplete stage, with question count + anchor", () => {
    const reg = buildReg(mkArea("brackets")); // one stage "Intro", 1 question
    renderAt("/", reg, buildStore(reg));
    const link = screen.getByText("Intro").closest("a");
    expect(link?.getAttribute("href")).toBe("/math/algebra/brackets#stage-1");
    expect(screen.getByText(/1 question/)).toBeTruthy();
  });

  it("up next: skips completed stages to the next incomplete one", () => {
    const reg = buildReg(
      mkArea("brackets", { stages: [stage("First"), stage("Second")] }),
    );
    const store = buildStore(reg);
    store.recordAttempt(AREA_ID, 0, true); // complete stage 0
    renderAt("/", reg, store);
    const link = screen.getByText("Second").closest("a");
    expect(link?.getAttribute("href")).toBe("/math/algebra/brackets#stage-2");
    expect(screen.queryByText("First")).toBeNull();
  });

  it("up next: hidden with an 'all caught up' line when everything is complete", () => {
    const reg = buildReg(mkArea("brackets"));
    const store = buildStore(reg);
    store.recordAttempt(AREA_ID, 0, true);
    renderAt("/", reg, store);
    expect(screen.getByText(/all caught up/i)).toBeTruthy();
    expect(screen.queryByText("Intro")).toBeNull();
  });

  it("your progress: stats reflect the seeded store", () => {
    const reg = buildReg(
      mkArea("brackets", { stages: [stage("First"), stage("Second")] }),
    );
    const store = buildStore(reg);
    store.recordOutcome(AREA_ID, 0, "core", 0, "correct");
    store.recordAttempt(AREA_ID, 0, true); // stage 0 complete, 1 question answered
    renderAt("/", reg, store);
    expect(statVal("Areas completed")).toBe("0/1");
    expect(statVal("Exercises completed")).toBe("1/2");
    expect(statVal("Questions answered")).toBe("1");
  });
});

describe("AreaPage — layout", () => {
  it("renders the stage's notes, a video stage, and the worksheet", () => {
    const reg = buildReg(mkArea("brackets"));
    renderAt(`/${AREA_ID}`, reg, buildStore(reg));
    expect(screen.getByRole("heading", { name: "Notes heading" })).toBeTruthy();
    expect(screen.getByText("Video coming soon.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Right" })).toBeTruthy();
  });

  it("renders not-found for an unknown area", () => {
    const reg = buildReg(mkArea("brackets"));
    renderAt("/no/such/area", reg, buildStore(reg));
    expect(screen.getByRole("heading", { name: "Not found" })).toBeTruthy();
  });

  it("numbers stages in authored order with a small-caps label + title heading", () => {
    const reg = buildReg(
      mkArea("brackets", { stages: [stage("S-A"), stage("S-B")] }),
    );
    renderAt(`/${AREA_ID}`, reg, buildStore(reg));
    expect(screen.getByText("Stage 1")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "S-A" })).toBeTruthy();
    expect(screen.getByText("Stage 2")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "S-B" })).toBeTruthy();
  });

  it("numbers the questions within a stage exercise 1..n", () => {
    const reg = buildReg(
      mkArea("brackets", {
        stages: [stage("Three", { questions: [mcQuestion("Q-one", "a", "b"), textQ("Q-two"), textQ("Q-three")] })],
      }),
    );
    const { container } = renderAt(`/${AREA_ID}`, reg, buildStore(reg));
    const nums = Array.from(container.querySelectorAll(".ws-row__num")).map((n) => n.textContent);
    expect(nums).toEqual(["1", "2", "3"]);
  });

  it("renders an extra-practice pool when present", () => {
    const reg = buildReg(
      mkArea("brackets", {
        stages: [stage("S", { questions: [mcQuestion("core-q", "R", "W")], extra: [mcQuestion("extra-q", "ER", "EW")] })],
      }),
    );
    renderAt(`/${AREA_ID}`, reg, buildStore(reg));
    expect(screen.getByText("More practice")).toBeTruthy();
    expect(screen.getByRole("button", { name: "ER" })).toBeTruthy();
  });
});

describe("AreaPage — solution modal", () => {
  const oneText = (answer?: string, working?: string[]) =>
    mkArea("brackets", { stages: [stage("T", { questions: [textQ("Solve it", answer, working)] })] });

  it("opens a worked-solution modal, moves focus in, closes on Escape, returns focus", () => {
    const reg = buildReg(oneText("Answer here", ["First step", "Second step"]));
    renderAt(`/${AREA_ID}`, reg, buildStore(reg));
    const icon = screen.getByRole("button", { name: "Show solution for question 1" });

    fireEvent.click(icon);
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(within(dialog).getByText("Answer here")).toBeTruthy();
    expect(within(dialog).getByText("First step")).toBeTruthy();

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(icon);
  });

  it("shows an honest empty state when there is no worked solution", () => {
    const reg = buildReg(oneText());
    renderAt(`/${AREA_ID}`, reg, buildStore(reg));
    fireEvent.click(screen.getByRole("button", { name: "Show solution for question 1" }));
    expect(screen.getByText("No worked solution provided.")).toBeTruthy();
  });

  it("MC: marks inline, then opens an explanation-only modal (no self-mark)", () => {
    const reg = buildReg(mkArea("brackets"));
    const store = buildStore(reg);
    renderAt(`/${AREA_ID}`, reg, store);

    fireEvent.click(screen.getByRole("button", { name: "Right" }));
    expect(screen.getByLabelText("Answered correctly")).toBeTruthy();
    expect(store.getStageProgress(AREA_ID, 0)?.core[0]).toBe("correct");

    fireEvent.click(screen.getByRole("button", { name: "Show explanation for question 1" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByRole("button", { name: "I got it" })).toBeNull();
    expect(dialog.querySelector(".qr-mc__option--correct")).not.toBeNull();
  });

  it("non-MC: self-mark records the outcome and closes the modal", () => {
    const reg = buildReg(oneText("A"));
    const store = buildStore(reg);
    renderAt(`/${AREA_ID}`, reg, store);

    fireEvent.click(screen.getByRole("button", { name: "Show solution for question 1" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "I got it" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(store.getStageProgress(AREA_ID, 0)?.core[0]).toBe("correct");
    expect(screen.getByLabelText("Answered correctly")).toBeTruthy();
  });
});

describe("AreaPage — progress & gating", () => {
  it("restores the answered-state indicator from the store on load", () => {
    const reg = buildReg(mkArea("brackets"));
    const store = buildStore(reg);
    store.recordOutcome(AREA_ID, 0, "core", 0, "correct");
    renderAt(`/${AREA_ID}`, reg, store);
    expect(screen.getByLabelText("Answered correctly")).toBeTruthy();
  });

  it("nothing locks — every stage's questions render (free navigation)", () => {
    const reg = buildReg(
      mkArea("brackets", {
        stages: [
          stage("First", { questions: [mcQuestion("q1", "R0", "W0")] }),
          stage("Second", { questions: [mcQuestion("q2", "R1", "W1")] }),
        ],
      }),
    );
    renderAt(`/${AREA_ID}`, reg, buildStore(reg));
    expect(screen.getByRole("button", { name: "R0" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "R1" })).toBeTruthy(); // not locked
    expect(screen.queryByText(/first to unlock/i)).toBeNull();
  });

  it("completes a stage when every core question is ANSWERED, even incorrectly", () => {
    const reg = buildReg(
      mkArea("brackets", { stages: [stage("Only", { questions: [mcQuestion("q", "Yes", "No")] })] }),
    );
    const store = buildStore(reg);
    renderAt(`/${AREA_ID}`, reg, store);
    expect(screen.queryByText(/completed every stage/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "No" })); // wrong, but answered
    expect(screen.getByText(/completed every stage/i)).toBeTruthy();
    expect(store.getStageProgress(AREA_ID, 0)?.completedAt).not.toBeNull();
  });

  it("extra outcomes never affect stage completion", () => {
    const reg = buildReg(
      mkArea("brackets", {
        stages: [
          stage("S", {
            questions: [textQ("core")],
            extra: [mcQuestion("extra-q", "ER", "EW")],
          }),
        ],
      }),
    );
    const store = buildStore(reg);
    renderAt(`/${AREA_ID}`, reg, store);
    fireEvent.click(screen.getByRole("button", { name: "ER" })); // answer the EXTRA question
    expect(store.getStageProgress(AREA_ID, 0)?.completedAt).toBeNull(); // core still unanswered
    expect(screen.queryByText(/completed every stage/i)).toBeNull();
  });

  it("area-complete banner appears with a back-to-library CTA", () => {
    const reg = buildReg(
      mkArea("brackets", { stages: [stage("Only", { questions: [mcQuestion("q", "Yes", "No")] })] }),
    );
    renderAt(`/${AREA_ID}`, reg, buildStore(reg));
    fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    expect(screen.getByText(/completed every stage/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to library" })).toBeTruthy();
  });

  it("hero deep-link anchor target (stage-1) exists on the area page", () => {
    const reg = buildReg(mkArea("brackets", { title: "Brackets" }));
    const store = buildStore(reg);
    renderAt("/", reg, store);
    const href = screen.getByText("Start here").closest("a")?.getAttribute("href");
    expect(href).toContain("#stage-1");
    cleanup();

    const { container } = renderAt(`/${AREA_ID}`, reg, store);
    expect(container.querySelector("#stage-1")).not.toBeNull();
  });
});
