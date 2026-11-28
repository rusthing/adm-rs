import { describe, expect, it } from "vitest";
import type { AdmMenuVo } from "@/lib/types";
import { titleOfPath } from "./title";

function menu(overrides: Partial<AdmMenuVo> & Pick<AdmMenuVo, "id" | "name" | "path">): AdmMenuVo {
  return {
    treeCode: "001",
    code: overrides.id,
    linkType: 1,
    enabled: true,
    visible: true,
    appId: "app",
    ...overrides,
  } as AdmMenuVo;
}

describe("titleOfPath", () => {
  it("内置页面走静态表，不把路径暴露给用户", () => {
    expect(titleOfPath("/")).toBe("后台管理");
    expect(titleOfPath("/dashboard")).toBe("后台管理");
    expect(titleOfPath("/profile")).toBe("个人资料");
    expect(titleOfPath("/login")).toBe("登录");
  });

  it("动态菜单取后端下发的真实名称，不用路径末段", () => {
    const menus = [
      menu({ id: "1", name: "菜单管理", path: "/menus" }),
      menu({ id: "2", name: "组织管理", path: "/orgs" }),
    ];
    expect(titleOfPath("/menus", menus)).toBe("菜单管理");
    expect(titleOfPath("/orgs", menus)).toBe("组织管理");
  });

  it("最长路径匹配：三级页面不会被父级目录抢走标题", () => {
    const menus = [
      menu({ id: "1", name: "系统管理", path: "/system" }),
      menu({ id: "2", name: "角色分组", path: "/system/role-groups" }),
      menu({ id: "3", name: "分组详情", path: "/system/role-groups/detail" }),
    ];
    expect(titleOfPath("/system/role-groups/detail", menus)).toBe("分组详情");
    expect(titleOfPath("/system/role-groups", menus)).toBe("角色分组");
    expect(titleOfPath("/system/other", menus)).toBe("系统管理");
  });

  it("停用菜单与外链不参与匹配", () => {
    const menus = [
      menu({ id: "1", name: "停用页面", path: "/off", enabled: false }),
      menu({ id: "2", name: "外部系统", path: "https://example.com/x", linkType: 2 }),
    ];
    expect(titleOfPath("/off", menus)).toBe("off");
    expect(titleOfPath("/x", menus)).toBe("x");
  });

  it("尾斜杠归一化，菜单还没返回时退回末段", () => {
    expect(titleOfPath("/menus/", [menu({ id: "1", name: "菜单管理", path: "/menus" })])).toBe(
      "菜单管理",
    );
    expect(titleOfPath("/some/deep/page")).toBe("page");
    expect(titleOfPath("/")).toBe("后台管理");
  });
});
