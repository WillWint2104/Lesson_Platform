import { describe, it, expect } from "vitest";
import { parseYouTubeId } from "@/shared/youtube";

const ID = "dQw4w9WgXcQ";

describe("parseYouTubeId — accepted forms", () => {
  it("a bare 11-character id", () => {
    expect(parseYouTubeId(ID)).toBe(ID);
  });
  it("a full watch URL", () => {
    expect(parseYouTubeId(`https://www.youtube.com/watch?v=${ID}`)).toBe(ID);
  });
  it("a watch URL with extra params", () => {
    expect(parseYouTubeId(`https://youtube.com/watch?v=${ID}&t=42s&list=PLx`)).toBe(ID);
  });
  it("a youtu.be short link", () => {
    expect(parseYouTubeId(`https://youtu.be/${ID}`)).toBe(ID);
  });
  it("a youtu.be link with a tracking param", () => {
    expect(parseYouTubeId(`https://youtu.be/${ID}?si=AbC`)).toBe(ID);
  });
  it("an embed URL", () => {
    expect(parseYouTubeId(`https://www.youtube.com/embed/${ID}`)).toBe(ID);
  });
  it("a nocookie embed URL with params", () => {
    expect(parseYouTubeId(`https://www.youtube-nocookie.com/embed/${ID}?rel=0`)).toBe(ID);
  });
  it("trims surrounding whitespace", () => {
    expect(parseYouTubeId(`   ${ID}  `)).toBe(ID);
  });
});

describe("parseYouTubeId — rejections", () => {
  it.each([
    ["empty string", ""],
    ["whitespace only", "   "],
    ["plain text", "not a url"],
    ["another video host", "https://vimeo.com/123456789"],
    ["an id that is too short", "abc123"],
    ["an id that is too long", `${ID}XX`],
    ["an id with illegal chars", "abcdef ghijk"],
    ["a watch URL with no v param", "https://youtube.com/watch"],
    ["a watch URL with a malformed v", "https://youtube.com/watch?v=short"],
    ["a youtu.be link with a malformed id", "https://youtu.be/short"],
    ["a non-http protocol", "ftp://youtube.com/watch?v=dQw4w9WgXcQ"],
    ["a lookalike host", "https://notyoutube.com/watch?v=dQw4w9WgXcQ"],
  ])("rejects %s", (_label, input) => {
    expect(parseYouTubeId(input)).toBeNull();
  });

  it("rejects non-string input", () => {
    expect(parseYouTubeId(null)).toBeNull();
    expect(parseYouTubeId(undefined)).toBeNull();
    expect(parseYouTubeId(123)).toBeNull();
  });
});
