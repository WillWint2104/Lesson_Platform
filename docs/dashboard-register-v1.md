# Dashboard register — v1

Status: locked. **Extends, does not replace, `docs/design-language-v2.md`.** The app
has two visual registers sharing one token family — the same token *names/roles*
(`--ink`, `--mint`, `--line`, …) with **register-scoped values**: lesson surfaces
resolve them to the design-language-v2 §2 values, dashboard surfaces to the values
below (scoped under the dashboard shell, not global overrides):

- **LESSON register** (existing): `docs/design-language-v2.md` — grid canvas,
  mint-strip worksheet panels. Lesson/stage/exercise/focus surfaces only.
- **DASHBOARD register** (this doc): home/dashboard, explore, course-detail,
  onboarding. Modern-minimal (Notion/Linear-like). **NO grid texture, NO mint
  header strips on dashboard surfaces.**

## Dashboard register — tokens

```css
--bg:#f3f5f7      /* shell background; deeper grey than lesson canvas, no grid texture */
--surface:#ffffff; --line:#dde2e8; --line-2:#ecf0f3
--ink:#16191e; --body:#343b45; --muted:#5d6673; --faint:#8b95a1
--mint:#bfe8d2; --mint-tint:#e9f8f0; --mint-line:#8fd6b1; --mint-ink:#175c39
--hover:#f4f7f8
```

Radii: cards/panels 12px, buttons 9–10px, badges 7–10px, chips 6px, filter pills 999px.

Cards: soft shadow (`0 1px 6px rgba(22,25,30,.04)`), hover border-color → `--mint-line`.

Contrast rules: secondary text is `--muted` at weight 600 minimum; never `--faint`
on `--bg`; borders always visible. Grey fills only for disabled/soon states.

Mint is accent only: active nav item (mint-tint bg + inset 3px mint-line bar), the
single primary button per view, status chips, progress bars, badges. One focal
element per view maximum.

## Layout

Sidebar 248px, white, 1px `--line` right border: brand (28px mint tile + wordmark),
nav (Home, Explore courses, Progress), then "YOUR COURSES" group listing joined
courses with a % or "soon" chip; footer = avatar + "Local progress". Nav items:
8px 10px padding, radius 8, hover `--hover`, active per mint rule. Icons inline SVG
only — never emoji.

Main column: 34px 44px padding, max-width ~980px.

## Screens

HOME/DASHBOARD: greeting (date small `--muted`, "Welcome back" 25px/800) →
CONTINUE card (the one focal element: mint border + soft mint shadow, 42px mint
play tile, kicker "CONTINUE", title 16px/800, sub line, primary Continue button) →
"[Course] — Topics": single bordered list (rows: 32px mint badge, name 700, meta,
right status chip "In progress · 8%" mint-tint, chevron; hover `--hover`) →
"All courses": card grid (minmax 260px), each = 36px year badge + name/meta + % +
6px progress bar; unjoined/unauthored = dashed border, grey badge, SOON chip.

EXPLORE COURSES (/explore): title + sub, filter pills (All / Junior 7–10 /
Senior 11–12), courses grouped Senior/Junior as cards: year badge, name, stream
meta, stat chips (N TOPICS, N QUESTIONS, CONTENT GROWING or COMING SOON), Join
control: "+ Join course" (mint) → "✓ Added" + JOINED mint chip.
Scaffolded-but-empty courses are joinable ("content coming"); purely-future years
render as dashed soon-cards without a join button.

COURSE DETAIL (/explore/:course): 52px badge + title + curriculum line, stat
chips, bordered topic list (AVAILABLE / SOON chips), CTA row: primary
"Join [course]" + ghost "Back to explore" + note "Joining adds it to your
courses — progress tracked separately per course."

FIRST-VISIT ONBOARDING: if no joined courses and no remembered course, show a
single centered welcome card (mint tile, "Welcome to Lesson Platform", one
descriptive line, year grid 7–12 with available courses selectable and unauthored
ones disabled with SOON, one primary "Start with [selection]" button, footnote
"Your progress is saved in this browser on this device."). Choosing a year joins
that course and lands on its dashboard.

## Local enrolment (pre-accounts)

joinedCourses: persisted list of course ids in the progress store; joining =
add + appears under YOUR COURSES; the remembered current course must be a joined
course. No server, no auth. These screens become the real signup flow when
accounts land — design nothing throwaway.

## Enlarged-content & navigation rules (apply to the LESSON register; also appended to design-language-v2.md — §7c addendum + chrome addendum)

Focus dialogs exist for READABILITY: content scales ≥ 2x worksheet size, centered
single column (max-width ~560px in-dialog), rem-based sizing (browser zoom
compounds). Applies to question focus AND notes sections. Top-bar navigation
elements are buttons/links at body contrast with visible bounds — never muted
corner text; min 40px hit targets; visible mint focus rings.
