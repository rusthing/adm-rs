import { describe, expect, it } from "vitest";
import { matchPermUrn } from "@/auth/perm";

describe("matchPermUrn", () => {
  it("按路径段边界匹配，role 不能命中 role-group / role-user / role-perm", () => {
    const perms = [
      "GET:/adm/role-group/page",
      "GET:/adm/role-user/list",
      "POST:/adm/role-perm",
    ];
    expect(matchPermUrn(perms, "GET:/adm/role")).toBe(false);
  });

  it("完全相等或前缀后紧跟 / 时命中", () => {
    const perms = ["GET:/adm/role", "GET:/adm/user/page", "POST:/adm/user"];
    expect(matchPermUrn(perms, "GET:/adm/role")).toBe(true);
    expect(matchPermUrn(perms, "GET:/adm/user")).toBe(true);
    expect(matchPermUrn(perms, "GET:/adm/user/1")).toBe(false);
  });

  it("忽略大小写与末尾斜杠，空前缀直接拒绝", () => {
    const perms = ["get:/ADM/Role/1"];
    expect(matchPermUrn(perms, "GET:/adm/role/")).toBe(true);
    expect(matchPermUrn(perms, "  ")).toBe(false);
    expect(matchPermUrn([], "GET:/adm/role")).toBe(false);
  });
});
