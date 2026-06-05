/**
 * @file progress-store.ts — Learner progress store.
 *
 * Persists and restores learner progress, NAMESPACED by subject/topic so that
 * strictly-isolated content packs never read or write each other's state
 * (CLAUDE.md §a).
 *
 * Save/restore symmetry is critical: every newly persisted field must be
 * explicitly added to the restore path (CLAUDE.md §c rule 3). Stored IDs must
 * be validated against the registry before use — truthiness is not validity
 * (rule 7).
 *
 * Stub only — no logic yet (stack decision pending, CLAUDE.md §f).
 */

// Stub module: no exports yet. Present so the file is a module under
// isolatedModules (CLAUDE.md §f).
export {};
