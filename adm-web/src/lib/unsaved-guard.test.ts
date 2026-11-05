import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toInternalPath } from "@/lib/unsaved-guard";

afterEach(() => vi.unstubAllEnvs());

describe("toInternalPath — BrowserRouter", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_ROUTER", undefined);
  });

  it("把 <Link> 的 href 转成可 navigate 的站内路径", () => {
    const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
    expect(toInternalPath(`${base}/users`)).toBe("/users");
    expect(toInternalPath(`${base}/users?page=1#top`)).toBe("/users?page=1#top");
    expect(toInternalPath(`${base}/`)).toBe("/");
  });

  it("外链、协议相对、反斜杠与控制字符一律不拦", () => {
    expect(toInternalPath("https://example.com")).toBeNull();
    expect(toInternalPath("//evil.example")).toBeNull();
    expect(toInternalPath("/a\\b")).toBeNull();
    expect(toInternalPath("/users\nfoo")).toBeNull();
    expect(toInternalPath("#/users")).toBeNull();
    expect(toInternalPath(null)).toBeNull();
    expect(toInternalPath("")).toBeNull();
  });
});

describe("toInternalPath — 子路径部署", () => {
  it("带 basename 的 href 去掉前缀，应用外的绝对路径不拦", () => {
    vi.stubEnv("VITE_ROUTER", undefined);
    vi.stubEnv("BASE_URL", "/adm-web/");
    expect(toInternalPath("/adm-web/users")).toBe("/users");
    expect(toInternalPath("/adm-web")).toBe("/");
    expect(toInternalPath("/other-app/users")).toBeNull();
  });
});

describe("toInternalPath — HashRouter", () => {
  it("只认 #/ 开头的站内路径", () => {
    vi.stubEnv("VITE_ROUTER", "hash");
    expect(toInternalPath("#/users")).toBe("/users");
    expect(toInternalPath("#/users?x=1")).toBe("/users?x=1");
    expect(toInternalPath("#//evil.example")).toBeNull();
    expect(toInternalPath("/users")).toBeNull();
    expect(toInternalPath("https://example.com")).toBeNull();
  });
});
