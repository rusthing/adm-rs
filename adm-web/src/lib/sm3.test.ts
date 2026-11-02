import { describe, expect, it } from "vitest";
import { sm3 } from "./sm3";

describe("sm3", () => {
  it("matches GB/T 32905-2016 vector", () => {
    expect(sm3("abc")).toBe(
      "66c7f0f462eeedd9d1f2d46bdc10e4e24167c4875cf2f7a2297da02b8f4ba8e0",
    );
  });

  it("matches the seed admin password digest", () => {
    expect(sm3("admin123")).toBe(
      "667c756cf9334e328a56e44e906245c8e214c655a160f18fdb84d79c209c49cf",
    );
  });

  it("handles empty input", () => {
    expect(sm3("")).toBe(
      "1ab21d8355cfa17f8e61194831e81a8f22bec8c728fefb747ed035eb5082aa2b",
    );
  });

  it("encodes UTF-8", () => {
    expect(sm3("中文")).toHaveLength(64);
  });
});
