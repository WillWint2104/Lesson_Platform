import { describe, it, expect } from "vitest";
import { checkEquivalence, normalizeMathInput } from "@/render/questions/answerCheck";

describe("normalizeMathInput", () => {
  it("strips $…$ / $$…$$ delimiters", () => {
    expect(normalizeMathInput("$4x + 12$")).toBe("4x + 12");
    expect(normalizeMathInput("$$x^2$$")).toBe("x^2");
  });
  it("converts a small LaTeX subset to math.js syntax", () => {
    expect(normalizeMathInput("$\\tfrac{1}{2}$")).toBe("((1)/(2))");
    expect(normalizeMathInput("2 \\times x")).toBe("2 * x");
    expect(normalizeMathInput("x^{2}")).toBe("x^2");
  });
});

describe("checkEquivalence (algebraic, §8)", () => {
  it("accepts reorderings and factored / expanded forms", () => {
    expect(checkEquivalence("12 + 4x", "$4x + 12$")).toBe(true);
    expect(checkEquivalence("4(x+3)", "$4x + 12$")).toBe(true);
    expect(checkEquivalence("(2x+3)(x+4)", "$2x^2 + 11x + 12$")).toBe(true);
    expect(checkEquivalence("(x+1)(x+4)", "$x^2 + 5x + 4$")).toBe(true);
  });

  it("accepts equivalent fraction-coefficient answers", () => {
    expect(checkEquivalence("x + 3", "$\\tfrac{1}{2}(2x + 6)$")).toBe(true);
  });

  it("works with a non-x variable", () => {
    expect(checkEquivalence("18a + 63", "$9(2a + 7)$")).toBe(true);
  });

  it("rejects wrong answers and near-misses", () => {
    expect(checkEquivalence("4x + 9", "$4x + 12$")).toBe(false);
    expect(checkEquivalence("x + 3.01", "$x + 3$")).toBe(false);
    expect(checkEquivalence("x - 4", "$x + 4$")).toBe(false);
  });

  it("rejects empty / unparseable input rather than throwing", () => {
    expect(checkEquivalence("", "$x + 3$")).toBe(false);
    expect(checkEquivalence("   ", "$x + 3$")).toBe(false);
    expect(checkEquivalence("4x +", "$4x$")).toBe(false); // syntax error → false
    expect(checkEquivalence(")(", "$x$")).toBe(false);
  });
});
