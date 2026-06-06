# Screen specs (canonical)

The approved mockups, captured here as the canonical reference for the app-shell
screens. See CLAUDE.md §f for the route table.

## Library (`/`)

- **Header:** app name + a placeholder identity chip (real profile arrives with
  accounts).
- **Subject pills:** driven entirely by the registry's present subjects (never
  hardcoded). One active per selection; a single disabled "more soon" pill.
- **Continue hero ("jump back in"):** from `lastVisitedLessonId`; hidden when
  null. Currently links to the lesson's topic-area page — TODO: repoint to the
  lesson page once it exists.
- **Topic cards:** icon slot, topic name, topic-area + lesson counts, progress
  bar + % from the progress store's topic-scoped queries. A single-area topic
  links straight to that area; a multi-area topic lists its areas as rows, each
  linking to its own page (the topic page with multiple areas is future work).

## Lesson selection (`/:subject/:topic/:topicArea`)

Breadcrumb → title + "N lessons · then the topic checkpoint" + overall % →
progress bar → ordered lesson cards → checkpoint card.

**Lesson card anatomy:**
- **Status circle:** green check (done) / white-green play ring (current) /
  numbered beige (upcoming).
- **Title:** "N · Title".
- **Metadata line:** video duration (or "video coming soon" when `src` is null),
  notes presence, question count, and progress/completion.
- **Right action:** quiet **Review** (done), primary **Continue** (current), or
  a plain-text unlock condition (locked).

**Sequential unlock:** lesson `i` is unlocked iff `i === 0` or lesson `i−1` has a
`completedAt`. "Current" is the first unlocked-incomplete lesson. Completed
lessons stay openable (Review). Logic lives in the pure `/src/app/unlock.ts`.

**Checkpoint card:** gold dashed, trophy circle, "mixed questions from this topic
only · unlocks after lesson N". Locked-only for now.

## Not-found

Unknown routes AND invalid hierarchy params (no such topic area / lesson in the
registry — a stale-id guard, lesson 7) render the same token-styled not-found
with a link home.
