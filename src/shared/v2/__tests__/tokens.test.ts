import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// design-language-v2 §2: the exact token scale. This guard fails if a token is
// dropped or renamed, so the locked scale and the primitives can't drift apart.
const tokensCss = readFileSync(
  fileURLToPath(new URL("../../../../styles/tokens-v2.css", import.meta.url)),
  "utf8",
);

const REQUIRED_TOKENS = [
  // canvas & surfaces
  "--page",
  "--grid",
  "--surface",
  "--line",
  "--line-2",
  // ink ladder
  "--ink",
  "--body",
  "--muted",
  "--faint",
  // the single green scale
  "--mint-strip",
  "--mint",
  "--mint-tint",
  "--mint-line",
  "--qline",
  "--mint-ink",
  // the single red
  "--red",
  "--red-tint",
  "--red-line",
  // fonts (§3) — incl. the mono face
  "--v2-font-head",
  "--v2-font-body",
  "--v2-font-mono",
];

describe("tokens-v2.css (design-language-v2 §2/§3)", () => {
  it.each(REQUIRED_TOKENS)("defines %s", (token) => {
    expect(tokensCss).toContain(`${token}:`);
  });

  it("pins the exact §2 hexes for the green scale and the single red", () => {
    expect(tokensCss).toContain("--mint-strip: #b9f5d6");
    expect(tokensCss).toContain("--mint: #cdeede");
    expect(tokensCss).toContain("--mint-ink: #1c6b43");
    expect(tokensCss).toContain("--red: #c4625b");
  });

  it("wires JetBrains Mono as the meta/micro-label face (§3)", () => {
    expect(tokensCss).toContain("JetBrains Mono");
  });
});
