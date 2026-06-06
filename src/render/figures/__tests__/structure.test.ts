/**
 * STRUCTURAL ISOLATION GUARANTEE — treat as untouchable.
 *
 * Statically scans figure sources and FAILS on any cross-contamination:
 *   - a kind importing a sibling kind
 *   - shared/ importing a kind
 * This is the architectural guard that keeps problem-family conventions sealed.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const figuresDir = fileURLToPath(new URL("../", import.meta.url)); // src/render/figures/
const kindsDir = join(figuresDir, "kinds");
const sharedDir = join(figuresDir, "shared");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

function importSpecs(file: string): string[] {
  const src = readFileSync(file, "utf8");
  const specs: string[] = [];
  const re = /\bfrom\s+["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) specs.push(m[1] ?? m[2] ?? "");
  return specs;
}

const kinds = readdirSync(kindsDir).filter((k) => statSync(join(kindsDir, k)).isDirectory());

describe("figure isolation (structural)", () => {
  it("discovers the kind directories", () => {
    expect(kinds.length).toBeGreaterThanOrEqual(2);
  });

  it("no kind imports a sibling kind", () => {
    for (const kind of kinds) {
      for (const file of walk(join(kindsDir, kind))) {
        for (const spec of importSpecs(file)) {
          for (const other of kinds) {
            if (other === kind) continue;
            const refsSibling = new RegExp(`(^|/)${other.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(/|$)`).test(spec);
            expect(refsSibling, `${file} imports sibling kind '${other}': ${spec}`).toBe(false);
          }
        }
      }
    }
  });

  it("shared never imports a kind", () => {
    for (const file of walk(sharedDir)) {
      for (const spec of importSpecs(file)) {
        expect(/(^|\/)kinds(\/|$)/.test(spec), `${file} imports from kinds: ${spec}`).toBe(false);
      }
    }
  });
});
