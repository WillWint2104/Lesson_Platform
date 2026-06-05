/**
 * @file loader.js — Content ingestion loader.
 *
 * Loads lesson manifests and their referenced notes/questions JSON from the
 * /content hierarchy (subject → topic → topic-area → lesson).
 *
 * Content packs are strictly isolated: the loader must never resolve a path
 * outside the requested pack, and must never import across packs.
 *
 * Pairs with {@link ./validator.js} — nothing loaded here is trusted until it
 * has passed validation (CLAUDE.md §c rule 6).
 *
 * Stub only — no logic yet (stack decision pending, CLAUDE.md §f).
 */
