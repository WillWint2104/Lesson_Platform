# Content Architecture — v1 (Year-level courses + reusable topic specs)

Status: proposed. Extends `docs/design-language-v2.md` (UI bits use the v2 system unchanged). Goal: introduce **year-level courses** as the top of the hierarchy, and a **spec-vs-instance** content model so a topic's structure is reusable across courses while its questions are per-course.

---

## 1. Model overview
Two ideas:

1. **Course is the new top level.** You pick a course (e.g. *Year 11 — Mathematics Advanced*) and land in that course's lesson pathway. A course is a year + stream of maths.
2. **Spec vs instance.** A topic's *structure* — its stages, the skill each teaches, the notes layout, the worked-example slots, the difficulty ramp, the common mistakes guarded — is a **reusable topic-spec** (an authoring template, not runtime content). Each course **instantiates** a topic with its own course-appropriate questions and examples. Same structure, different questions — never the identical set across courses.

This means: as you author Years 7–12 you accumulate a library of topic-specs, and each new course reuses the specs it needs with level-appropriate content. The runtime only ever reads per-course content; the topic-spec is an authoring aid and consistency guide.

---

## 2. Hierarchy & paths
Old: `/content/<subject>/<topic>/<area>/area.json`
New: `/content/<course>/<topic>/<area>/area.json` **+** `/content/<course>/course.json`

- `<course>` is the new top segment (e.g. `year-11-advanced`, `year-12-advanced`, `year-8`).
- Everything below (`<topic>/<area>/` → stages) is unchanged from contract v3/v4.
- The course folder carries a small manifest, `course.json`.

A course may have **zero areas** (registered but not yet authored) — the loader must handle an empty course gracefully (show it in the picker with a "content coming" state, never error).

---

## 3. `course.json` schema
```jsonc
{
  "id": "year-11-advanced",        // must equal the folder name (path-derived, validated)
  "displayName": "Year 11 · Mathematics Advanced",
  "year": 11,                       // integer 7–12
  "stream": "Advanced",             // "Advanced" | "Standard" | "Extension" | null (junior years)
  "subject": "Mathematics",         // reserved for future multi-subject; default "Mathematics"
  "order": 110                      // sort key for the picker (e.g. year*10 + stream rank)
}
```
Validation: `id` must match the folder; `year` 7–12; `displayName` single-line non-empty. The course list is derived by scanning `/content/*/course.json`.

---

## 4. Routing
- Add a `:course` segment at the top of all content routes: `/:course/:topic/:area/stage/:n` etc.
- A **course landing** at `/` (or `/courses`) shows the course picker.
- Selecting a course routes into that course's hub; the selected course is **remembered** (localStorage) and is switchable from the hub/sidebar.
- All existing stage/exercise/focus routes nest under `:course` with their behaviour unchanged.

---

## 5. Library / course picker (v2 design language)
- **Course picker**: the landing surface — course cards on the grid canvas (white, mint accent, mastery % per course), grouped/sorted by `order` (seniors first, or by year). "Pick your course."
- **Course hub**: after selecting, the existing home/hub (continue hero, topic cards, mastery) **scoped to that course**.
- A **course switcher** (top bar or sidebar) to change course without losing place.
- Empty courses render a calm "content coming soon" card, not an error.
All surfaces reuse the v2 tokens, panels, mint-strip, and shape language — no new visual system.

---

## 6. Progress store — schema v5
- Progress keys gain a **course namespace**: `course → topic/area → stage → { core:{answer,correct}, extra, completedAt }` (extending the v4 `{answer,correct}` shape under a course).
- Bump store v4 → **v5**. Preserve v4 verbatim under legacy (consistent with v2→v3 and v3→v4).
- **Migration: reset fresh.** Don't map v4 progress into the new course namespace — pre-launch, local-only, no real users, and the old keys had no course. Start clean; legacy kept for safety. (Same call we made on the answer-lock bump.)
- Keep the round-trip whitelist test and stale-key guards; add course to the key guards.

---

## 7. Migrating existing content (no rewriting)
- The current authored content (`Expanding Brackets`, NSW Year 8) is **relocated unchanged** under a `year-8` course: `/content/year-8/algebra/expanding-brackets/…`, plus a `year-8/course.json`. The question content is **not edited** — only its path moves; report the relocation.
- **Scaffold** two empty courses for the work ahead: `year-11-advanced/course.json` and `year-12-advanced/course.json` (no areas yet). They appear in the picker as "content coming," ready to author.
- If anything in the existing content fails validation under the new course-aware loader, report the validator output verbatim and stop — do not silently change authored questions.

---

## 8. Topic-spec library (authoring artifact — not runtime)
Location: `/docs/topic-specs/<topic>.md`, with a `TEMPLATE.md` and a short `README.md` explaining the model. These are authoring guides; the app does not read them.

### Topic-spec template (what each spec captures)
```
# Topic spec: <Topic name>
Skill summary: <one line — what the whole topic builds toward>

## Stages (reusable structure)
For each stage:
- Title
- Skill taught: <the single skill>
- Common mistake guarded: <the misconception this stage's REMEMBER + examples target>
- Notes: rule statement (the \frac-correct formula), 1–2 REMEMBER tips (guidance-only, positive, generalising)
- Worked-example slots: (1) rule demo, (2) stumbling-block case — what each must show
- Difficulty ramp: easy/medium dominant; hard optional

## Cross-level guidance
How this topic differs by course:
- Junior (e.g. Year 8): <scope, number ranges, contexts>
- Senior (e.g. Year 11 Advanced): <added depth, algebraic generality, harder cases>
(So each instance knows what to adjust — same structure, level-appropriate questions.)
```

### Instance authoring rules (per course)
- Follow the topic-spec's stage structure.
- **Different questions per course** — never reuse the identical question set across courses; level-appropriate numbers, contexts, and depth.
- Obey the v2 authoring rules: no skill creep, easy/medium dominant (hard optional), fractions as `\frac`, REMEMBER discipline, two standard worked examples, every numeric example verified by substitution, each question carries a canonical `answer` + hidden `difficulty`.

---

## 9. Runtime vs authoring (scope split)
- **Runtime (Claude Code builds)**: course level in the model + `course.json` + path/ingest/validate/types, routing with `:course`, course picker + scoped hub + switcher, progress v5 namespacing, relocation of existing content, scaffolding empty senior courses, topic-spec folder + template scaffold.
- **Authoring (you, with help)**: writing the topic-specs and the per-course content for Year 11 Advanced then Year 12 Advanced.

---

## 10. Future
- Multi-subject: `subject` on `course.json` is reserved; a subject layer can sit above course later without breaking the model.
- Course streams (Standard/Extension) slot in as additional courses with their own `course.json`.
- A topic-spec could later be machine-validated against instances (consistency linting) — optional, deferred.
