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

/** A course.json fixture for the given course slug (default "math" — matches mkArea). */
function mkCourse(
  id = "math",
  opts: { year?: number; displayName?: string; stream?: string | null } = {},
) {
  const year = opts.year ?? 8;
  return {
    [`/content/${id}/course.json`]: {
      id,
      displayName: opts.displayName ?? id,
      year,
      stream: opts.stream ?? null,
      subject: "Mathematics",
      order: year * 10,
    },
  };
}

function buildReg(...areas: Record<string, unknown>[]): AreaRegistry {
  return buildAreaRegistry(Object.assign({}, ...areas));
}
function buildStore(reg: AreaRegistry, backend: ReturnType<typeof createMemoryBackend> = createMemoryBackend()): ProgressStore {
  return createProgressStore({
    backend,
    areaIds: reg.areas.map((a) => a.id),
    courseIds: reg.courses.map((c) => c.id),
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
  const routes = [STAGE1, "/debug", "/no/such/area"];
  it.each(routes)("renders the lesson app bar + footer on %s", (path) => {
    const reg = buildReg(mkArea("brackets"));
    renderAt(path, reg, buildStore(reg));
    expect(screen.getByRole("link", { name: "Lesson Platform" })).toBeTruthy();
    const footer = screen.getByRole("contentinfo");
    expect(within(footer).getByText("Lesson Platform")).toBeTruthy();
  });

  it("lesson top bar: Back-to-course button, breadcrumb segments as real links, bounded switcher", () => {
    const reg = buildReg(mkArea("brackets", { title: "Brackets" }), mkCourse("math", { displayName: "Year 8" }));
    renderAt(STAGE1, reg, buildStore(reg));
    const bar = screen.getByRole("banner");
    // The brand wordmark links to the dashboard home ("/").
    expect(within(bar).getByRole("link", { name: "Lesson Platform" }).getAttribute("href")).toBe("/");
    // NAV zone: a real bounded "← Back to course" button → the course dashboard.
    expect(within(bar).getByRole("link", { name: /Back to course/ }).getAttribute("href")).toBe(
      "/math",
    );
    // Breadcrumb begins at the TOPIC (Topic › Area) — the course identity lives
    // in the right-side chip only, never duplicated in the breadcrumb.
    const crumb = within(bar).getByLabelText("Breadcrumb");
    expect(within(crumb).queryByRole("link", { name: "Year 8" })).toBeNull();
    expect(within(crumb).getByRole("link", { name: "Algebra" }).getAttribute("href")).toBe("/math");
    expect(within(crumb).getByRole("link", { name: "Brackets" }).getAttribute("href")).toBe(
      `/${AREA_ID}`,
    );
    // RIGHT: the course chip is one bounded hit target to the picker, with
    // "Switch" as a real button label inside it (not mono caps).
    const switcher = within(bar).getByRole("link", { name: /Switch course/ });
    expect(switcher.getAttribute("href")).toBe("/");
    expect(within(switcher).getByText("Year 8")).toBeTruthy();
    expect(within(switcher).getByText("Switch")).toBeTruthy();
  });

  it("shows the breadcrumb + mastery % in the top bar on an area route (§7a)", () => {
    const reg = buildReg(mkArea("brackets", { title: "Brackets", stages: [stage("A"), stage("B")] }));
    const store = buildStore(reg);
    store.recordAttempt(AREA_ID, 0, true); // 1 of 2 stages → 50%
    renderAt(STAGE1, reg, store);
    const bar = screen.getByRole("banner");
    expect(within(bar).getByLabelText("Breadcrumb")).toBeTruthy(); // breadcrumb present
    expect(within(bar).getByText("Brackets")).toBeTruthy(); // area title (breadcrumb current)
    // Mastery reads in sentence case ("Mastery 50%"), not mono caps.
    expect(within(bar).getByLabelText("50% mastery")).toBeTruthy();
    expect(within(bar).getByText(/Mastery/)).toBeTruthy();
  });

  it("hides the breadcrumb + mastery when there is no active area (/debug)", () => {
    const reg = buildReg(mkArea("brackets", { title: "Brackets" }));
    renderAt("/debug", reg, buildStore(reg));
    const bar = screen.getByRole("banner");
    expect(within(bar).queryByLabelText("Breadcrumb")).toBeNull(); // breadcrumb absent
    expect(within(bar).queryByText(/mastery/i)).toBeNull();
  });
});

describe("Register boundary (dashboard vs lesson)", () => {
  it("dashboard routes get the sidebar shell — no grid canvas, no mint strips", () => {
    const reg = buildReg(mkArea("brackets"), mkCourse("math"));
    const { container } = renderAt("/", reg, buildStore(reg));
    expect(container.querySelector(".dash-root")).not.toBeNull();
    expect(container.querySelector(".dash-sidebar")).not.toBeNull();
    expect(container.querySelector(".v2-canvas")).toBeNull(); // no grid texture
    expect(container.querySelector(".v2-panel__strip")).toBeNull(); // no mint strips
    expect(screen.queryByRole("contentinfo")).toBeNull(); // no lesson footer
  });

  it("lesson routes keep the lesson register — grid canvas, no dashboard sidebar", () => {
    const reg = buildReg(mkArea("brackets"), mkCourse("math"));
    const { container } = renderAt(STAGE1, reg, buildStore(reg));
    expect(container.querySelector(".v2-canvas")).not.toBeNull();
    expect(container.querySelector(".dash-root")).toBeNull();
    expect(container.querySelector(".dash-sidebar")).toBeNull();
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

describe("Dashboard home (/, /:course — dashboard-register-v1)", () => {
  it("greets, shows the current course's topics, and the all-courses grid", () => {
    const reg = buildReg(mkArea("brackets"), mkCourse("math", { displayName: "Year 8 Maths" }));
    const store = buildStore(reg);
    store.joinCourse("math"); // past first visit (fresh "/" shows onboarding)
    renderAt("/", reg, store);
    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Year 8 Maths — Topics" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "All courses" })).toBeTruthy();
  });

  it("CONTINUE card: fresh → first area stage 1; after a visit → the stored stage + view", () => {
    const reg = buildReg(
      mkArea("brackets", { title: "Brackets", stages: [stage("A"), stage("B")] }),
      mkCourse("math"),
    );
    const store = buildStore(reg);
    store.joinCourse("math");
    renderAt("/", reg, store);
    expect(screen.getByText("Brackets")).toBeTruthy(); // continue title = area title
    expect(screen.getByRole("link", { name: "Continue" }).getAttribute("href")).toBe(STAGE1);
    cleanup();

    store.setLastVisited(AREA_ID, 1, "exercise");
    renderAt("/", reg, store);
    expect(screen.getByRole("link", { name: "Continue" }).getAttribute("href")).toBe(
      `/${AREA_ID}/stage/2/exercise`,
    );
  });

  it("topic rows: badge + name + meta + status chip, linking to the area", () => {
    const reg = buildReg(
      mkArea("brackets", { stages: [stage("First"), stage("Second")] }),
      mkCourse("math"),
    );
    const store = buildStore(reg);
    store.joinCourse("math");
    renderAt("/", reg, store);
    let row = screen.getByText("Algebra").closest("a")!;
    expect(row.getAttribute("href")).toBe(`/${AREA_ID}`);
    expect(within(row as HTMLElement).getByText("Not started")).toBeTruthy();
    cleanup();

    store.recordAttempt(AREA_ID, 0, true); // 1 of 2 stages → 50%
    renderAt("/", reg, store);
    row = screen.getByText("Algebra").closest("a")!;
    expect(within(row as HTMLElement).getByText("In progress · 50%")).toBeTruthy();
  });

  it("all-courses grid: authored card links + shows %; empty course = dashed SOON, no link", () => {
    const reg = buildReg(
      mkArea("brackets"),
      mkCourse("math", { displayName: "Year 8 Maths", year: 8 }),
      mkCourse("year-11-advanced", { displayName: "Year 11 Advanced", year: 11, stream: "Advanced" }),
    );
    const store = buildStore(reg);
    store.joinCourse("math");
    const { container } = renderAt("/", reg, store);
    const grid = screen.getByRole("region", { name: "All courses" });
    const authored = within(grid).getByText("Year 8 Maths").closest("a");
    expect(authored?.getAttribute("href")).toBe("/math");
    const soon = within(grid).getByText("Year 11 Advanced").closest(".dash-card")!;
    expect(soon.classList.contains("dash-card--soon")).toBe(true);
    expect(within(soon as HTMLElement).getByText("Soon")).toBeTruthy();
    expect(soon.closest("a")).toBeNull(); // not clickable
    expect(container.querySelector('[role="alert"]')).toBeNull(); // never an error
  });

  it("/:course opens that course's home, remembers it, and persists (restore path)", () => {
    const reg = buildReg(mkArea("brackets"), mkCourse("math", { displayName: "Year 8 Maths" }));
    const backend = createMemoryBackend();
    const store = buildStore(reg, backend);
    renderAt("/math", reg, store);
    expect(screen.getByRole("heading", { name: "Year 8 Maths — Topics" })).toBeTruthy();
    // Opening makes it current (auto-join) and persists…
    expect(backend.getItem("lp:selected-course")).toBe("math");
    expect(store.isJoined("math")).toBe(true);
    // …and a FRESH store restores it from that backend (the restore path).
    expect(buildStore(reg, backend).getSelectedCourse()).toBe("math");
  });

  it("an unknown course is not-found; an empty course is 'content coming soon', never an error", () => {
    const reg = buildReg(
      mkArea("brackets"),
      mkCourse("math"),
      mkCourse("year-11-advanced", { displayName: "Year 11 Advanced", year: 11 }),
    );
    renderAt("/no-such-course", reg, buildStore(reg));
    expect(screen.getByRole("heading", { name: "Not found" })).toBeTruthy();
    cleanup();

    const { container } = renderAt("/year-11-advanced", reg, buildStore(reg));
    expect(screen.getByText("Content coming soon")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Continue" })).toBeNull(); // no focal card
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
});

describe("Dashboard sidebar", () => {
  it("brand → /, Home nav active on /, YOUR COURSES lists joined with a % chip", () => {
    const reg = buildReg(mkArea("brackets"), mkCourse("math", { displayName: "Year 8 Maths" }));
    const store = buildStore(reg);
    store.joinCourse("math");
    renderAt("/", reg, store);
    const sidebar = screen.getByRole("navigation", { name: "Dashboard" });
    expect(screen.getByRole("link", { name: /Lesson Platform/ }).getAttribute("href")).toBe("/");
    expect(within(sidebar).getByRole("link", { name: "Home" }).getAttribute("aria-current")).toBe(
      "page",
    );
    const yours = screen.getByRole("navigation", { name: "Your courses" });
    const item = within(yours).getByRole("link", { name: /Year 8 Maths/ });
    expect(item.getAttribute("href")).toBe("/math");
    expect(within(item).getByText("0%")).toBeTruthy();
  });

  it("a joined-but-empty course shows a 'Soon' chip; footer says Local progress", () => {
    const reg = buildReg(
      mkArea("brackets"),
      mkCourse("math"),
      mkCourse("year-11-advanced", { displayName: "Year 11 Advanced", year: 11 }),
    );
    const store = buildStore(reg);
    store.joinCourse("year-11-advanced");
    renderAt("/", reg, store);
    const yours = screen.getByRole("navigation", { name: "Your courses" });
    const item = within(yours).getByRole("link", { name: /Year 11 Advanced/ });
    expect(within(item).getByText("Soon")).toBeTruthy();
    expect(screen.getByText("Local progress")).toBeTruthy();
  });
});

describe("First-visit onboarding (/)", () => {
  const threeCourses = () =>
    buildReg(
      mkArea("brackets"),
      mkCourse("math", { displayName: "Year 8 Maths", year: 8 }),
      mkCourse("year-11-advanced", { displayName: "Year 11 Advanced", year: 11, stream: "Advanced" }),
    );

  it("a fresh visitor sees the centered welcome card, not the home", () => {
    const reg = threeCourses();
    renderAt("/", reg, buildStore(reg));
    expect(screen.getByRole("heading", { name: "Welcome to Lesson Platform" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Welcome back" })).toBeNull();
    expect(screen.getByText(/saved in this browser on this device/i)).toBeTruthy();
  });

  it("authored years are selectable; unauthored + unregistered years are disabled SOON", () => {
    const reg = threeCourses();
    renderAt("/", reg, buildStore(reg));
    const grid = screen.getByRole("group", { name: "Choose your year" });
    const year8 = within(grid).getByRole("button", { name: /Year 8/ }) as HTMLButtonElement;
    expect(year8.disabled).toBe(false);
    // Registered-but-empty (year 11) and unregistered (year 7) are both disabled.
    const year11 = within(grid).getByRole("button", { name: /Year 11/ }) as HTMLButtonElement;
    const year7 = within(grid).getByRole("button", { name: /Year 7/ }) as HTMLButtonElement;
    expect(year11.disabled).toBe(true);
    expect(year7.disabled).toBe(true);
  });

  it("Start with [selection] joins the course and lands on its dashboard", () => {
    const reg = threeCourses();
    const store = buildStore(reg);
    renderAt("/", reg, store);
    fireEvent.click(screen.getByRole("button", { name: /Start with Year 8 Maths/ }));
    expect(store.isJoined("math")).toBe(true);
    expect(store.getSelectedCourse()).toBe("math");
    expect(screen.getByRole("heading", { name: "Year 8 Maths — Topics" })).toBeTruthy();
  });

  it("a returning visitor (joined course) goes straight to the home", () => {
    const reg = threeCourses();
    const store = buildStore(reg);
    store.joinCourse("math");
    renderAt("/", reg, store);
    expect(screen.queryByRole("heading", { name: "Welcome to Lesson Platform" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeTruthy();
  });
});

describe("Explore courses (/explore)", () => {
  const reg3 = () =>
    buildReg(
      mkArea("brackets", { stages: [stage("A"), stage("B")] }),
      mkCourse("math", { displayName: "Year 8 Maths", year: 8 }),
      mkCourse("year-11-advanced", { displayName: "Year 11 Advanced", year: 11, stream: "Advanced" }),
    );

  it("is reachable from the sidebar and groups courses Senior/Junior", () => {
    const reg = reg3();
    const store = buildStore(reg);
    store.joinCourse("math");
    renderAt("/", reg, store);
    fireEvent.click(screen.getByRole("link", { name: /Explore courses/ }));
    expect(screen.getByRole("heading", { name: "Explore courses" })).toBeTruthy();
    expect(within(screen.getByLabelText("Senior courses")).getByText("Year 11 Advanced")).toBeTruthy();
    expect(within(screen.getByLabelText("Junior courses")).getByText("Year 8 Maths")).toBeTruthy();
  });

  it("authored cards show stat chips; empty registered = CONTENT GROWING but joinable", () => {
    const reg = reg3();
    renderAt("/explore", reg, buildStore(reg));
    const junior = screen.getByLabelText("Junior courses");
    expect(within(junior).getByText("1 topic")).toBeTruthy();
    expect(within(junior).getByText(/\d+ questions?/)).toBeTruthy();
    const senior = screen.getByLabelText("Senior courses");
    expect(within(senior).getByText("Content growing")).toBeTruthy();
    // Both registered courses carry a Join control.
    expect(screen.getAllByRole("button", { name: /Join course/ })).toHaveLength(2);
  });

  it("joining flips the control to ✓ Added with a JOINED chip and updates the sidebar", () => {
    const reg = reg3();
    const store = buildStore(reg);
    renderAt("/explore", reg, store);
    const senior = screen.getByLabelText("Senior courses");
    fireEvent.click(within(senior).getByRole("button", { name: /Join course/ }));
    expect(store.isJoined("year-11-advanced")).toBe(true);
    expect(within(senior).getByRole("button", { name: /Added/ })).toBeTruthy();
    expect(within(senior).getByText("Joined")).toBeTruthy();
    // Sidebar YOUR COURSES now lists it.
    const yours = screen.getByRole("navigation", { name: "Your courses" });
    expect(within(yours).getByRole("link", { name: /Year 11 Advanced/ })).toBeTruthy();
  });

  it("purely-future years render as dashed soon-cards without a join button", () => {
    const reg = reg3();
    renderAt("/explore", reg, buildStore(reg));
    const card = screen.getByText("Year 9 · Mathematics").closest(".dash-card")!;
    expect(card.classList.contains("dash-card--soon")).toBe(true);
    expect(within(card as HTMLElement).getByText("Coming soon")).toBeTruthy();
    expect(within(card as HTMLElement).queryByRole("button")).toBeNull();
  });

  it("filter pills narrow the groups", () => {
    const reg = reg3();
    renderAt("/explore", reg, buildStore(reg));
    fireEvent.click(screen.getByRole("button", { name: "Senior 11–12" }));
    expect(screen.queryByLabelText("Junior courses")).toBeNull();
    expect(screen.getByLabelText("Senior courses")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Junior 7–10" }));
    expect(screen.getByLabelText("Junior courses")).toBeTruthy();
    expect(screen.queryByLabelText("Senior courses")).toBeNull();
  });
});

describe("Course detail (/explore/:course)", () => {
  it("shows badge, curriculum line, stats, topic list, and the join CTA row", () => {
    const reg = buildReg(mkArea("brackets"), mkCourse("math", { displayName: "Year 8 Maths" }));
    const store = buildStore(reg);
    renderAt("/explore/math", reg, store);
    expect(screen.getByRole("heading", { name: "Year 8 Maths" })).toBeTruthy();
    expect(screen.getByText("Year 8 · Mathematics")).toBeTruthy(); // curriculum line
    expect(screen.getByText("Available")).toBeTruthy(); // topic chip
    expect(screen.getByText(/Joining adds it to your courses/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to explore" }).getAttribute("href")).toBe(
      "/explore",
    );
    fireEvent.click(screen.getByRole("button", { name: /Join Year 8 Maths/ }));
    expect(store.isJoined("math")).toBe(true);
    expect(screen.getByRole("button", { name: /Added/ })).toBeTruthy();
  });

  it("an empty course details as 'being authored' + Content growing, still joinable", () => {
    const reg = buildReg(
      mkCourse("year-11-advanced", { displayName: "Year 11 Advanced", year: 11, stream: "Advanced" }),
    );
    renderAt("/explore/year-11-advanced", reg, buildStore(reg));
    expect(screen.getByText("Content growing")).toBeTruthy();
    expect(screen.getByText("Topics are being authored")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Join Year 11 Advanced/ })).toBeTruthy();
  });

  it("an unknown course is not-found", () => {
    const reg = buildReg(mkCourse("math"));
    renderAt("/explore/nope", reg, buildStore(reg));
    expect(screen.getByRole("heading", { name: "Not found" })).toBeTruthy();
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

  it("notes sections expand into the shared enlarged dialog; Prev/Next CYCLE the sections", () => {
    const reg = buildReg(
      mkArea("brackets", {
        stages: [
          stage("S", {
            notes: [
              { type: "paragraph", text: "Rule prose." },
              { type: "paragraph", text: "$$a(b + c) = ab + ac$$" },
              { type: "callout", style: "key", text: "Remember me." },
              { type: "example", prompt: "Ex", answer: "$3$", steps: [{ tex: "3", why: "why text" }] },
            ],
            video: { src: null, duration: null },
          }),
        ],
      }),
    );
    renderAt(STAGE1, reg, buildStore(reg));
    const opener = screen.getByRole("button", { name: "Enlarge the rule" });
    fireEvent.click(opener);
    let dialog = screen.getByRole("dialog", { name: "The rule" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(within(dialog).getByText("Rule prose.")).toBeTruthy();

    // Footer Next is labelled with the NEXT section and cycles Rule → Remember.
    fireEvent.click(within(dialog).getByRole("button", { name: /Remember/ }));
    dialog = screen.getByRole("dialog", { name: "Remember" });
    expect(within(dialog).getByText("Remember me.")).toBeTruthy();

    // → Worked examples (tabs + WHY? + ANSWER preserved via the shared StepPlayer).
    fireEvent.click(within(dialog).getByRole("button", { name: /Worked examples/ }));
    dialog = screen.getByRole("dialog", { name: "Worked examples" });
    expect(within(dialog).getByRole("button", { name: "why?" })).toBeTruthy();

    // …and CYCLES back around to the rule.
    fireEvent.click(within(dialog).getByRole("button", { name: /The rule/ }));
    expect(screen.getByRole("dialog", { name: "The rule" })).toBeTruthy();

    // Esc closes and focus returns to the opener.
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("each notes section header carries its own enlarge affordance", () => {
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
    renderAt(STAGE1, reg, buildStore(reg));
    fireEvent.click(screen.getByRole("button", { name: "Enlarge worked examples" }));
    expect(screen.getByRole("dialog", { name: "Worked examples" })).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Enlarge remember" }));
    expect(screen.getByRole("dialog", { name: "Remember" })).toBeTruthy();
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

  it("arrow keys do NOT navigate while typing in the answer field (§7c)", () => {
    const reg = buildReg(twoQ);
    renderAt(EX1, reg, buildStore(reg));
    enlarge(1);
    const field = within(screen.getByRole("dialog")).getByLabelText("Your answer");
    fireEvent.keyDown(field, { key: "ArrowRight" }); // caret move, not a question jump
    expect(screen.getByRole("dialog", { name: "Question 1 of 2" })).toBeTruthy(); // still q1
  });

  it("traps Tab focus within the dialog (cycles last → first)", () => {
    const reg = buildReg(twoQ);
    renderAt(EX1, reg, buildStore(reg));
    enlarge(1);
    const dialog = screen.getByRole("dialog");
    const focusables = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => !el.hasAttribute("disabled"));
    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    last.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(document.activeElement).toBe(first); // forward wrap: last → first

    first.focus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last); // reverse wrap: first → last
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
