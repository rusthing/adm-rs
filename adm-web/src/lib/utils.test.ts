import { describe, expect, it } from "vitest";
import { safeInternalPath, shortId } from "@/lib/utils";

describe("safeInternalPath", () => {
  it("放行站内绝对路径（含 query / hash）并去掉首尾空白", () => {
    expect(safeInternalPath("/users")).toBe("/users");
    expect(safeInternalPath("  /users?page=1#top  ")).toBe("/users?page=1#top");
    expect(safeInternalPath("/")).toBe("/");
  });

  it("拒绝外链、协议相对 URL、伪协议与占位符", () => {
    expect(safeInternalPath("https://evil.example/path")).toBeNull();
    expect(safeInternalPath("javascript:alert(1)")).toBeNull();
    expect(safeInternalPath("//evil.example/path")).toBeNull();
    expect(safeInternalPath("#")).toBeNull();
    expect(safeInternalPath("users")).toBeNull();
    expect(safeInternalPath("")).toBeNull();
  });

  it("拒绝反斜杠变形、内嵌 :// 与控制字符", () => {
    expect(safeInternalPath("/\\evil.example")).toBeNull();
    expect(safeInternalPath("/redirect/https://evil.example")).toBeNull();
    expect(safeInternalPath("/users\njavascript:alert(1)")).toBeNull();
    expect(safeInternalPath("/users\u0000")).toBeNull();
    expect(safeInternalPath("/users\u007f")).toBeNull();
  });

  it("非字符串输入一律拒绝", () => {
    expect(safeInternalPath(null)).toBeNull();
    expect(safeInternalPath(undefined)).toBeNull();
    expect(safeInternalPath(123)).toBeNull();
    expect(safeInternalPath({ path: "/users" })).toBeNull();
  });
});

describe("shortId", () => {
  it("空值显示 --，短 ID 原样，长 ID 头 6 尾 4", () => {
    expect(shortId(null)).toBe("--");
    expect(shortId("123")).toBe("123");
    expect(shortId("1234567890123456789")).toBe("123456…6789");
  });
});
