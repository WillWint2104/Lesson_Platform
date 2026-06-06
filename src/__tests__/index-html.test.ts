import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

describe("index.html", () => {
  it("carries a noindex robots meta during soft-launch", () => {
    const html = readFileSync(fileURLToPath(new URL("../../index.html", import.meta.url)), "utf8");
    expect(html).toMatch(/<meta\s+name="robots"\s+content="noindex"\s*\/?>/i);
  });
});
