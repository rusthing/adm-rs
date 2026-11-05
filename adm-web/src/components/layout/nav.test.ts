import { describe, expect, it, vi } from "vitest";
import type { AdmMenuVo } from "@/lib/types";
import { buildNavTree, findNavTrail, flattenNav, ICON_NAMES, iconOf } from "@/components/layout/nav";

// nav.ts 只需要「组件是否已登记」这一个判断；把整张页面表隔离掉，保持纯逻辑单测。
vi.mock("@/pages/registry", () => ({
  isRegisteredComponent: (name?: string) =>
    Boolean(name && ["dashboard", "users", "roles", "menus"].includes(name)),
}));

function menu(
  overrides: Partial<AdmMenuVo> & Pick<AdmMenuVo, "id" | "treeCode" | "name" | "path">,
): AdmMenuVo {
  return {
    createrId: "",
    createMs: "0",
    updaterId: "",
    updateMs: "0",
    appId: "app",
    code: overrides.id,
    linkType: 1,
    keepAlive: false,
    visible: true,
    enabled: true,
    ...overrides,
  } as AdmMenuVo;
}

describe("buildNavTree", () => {
  it("按 treeCode 前缀构造任意层级，并给出完整祖先链", () => {
    const root = menu({ id: "m1", treeCode: "001", name: "系统管理", path: "/system" });
    const middle = menu({
      id: "m2",
      treeCode: "001001",
      name: "用户管理",
      path: "/system/users",
      component: "users",
    });
    const leaf = menu({
      id: "m3",
      treeCode: "001001001",
      name: "用户列表",
      path: "/system/users/list",
      component: "users",
    });
    const tree = buildNavTree([leaf, root, middle]);

    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("m1");
    expect(tree[0].children.map((node) => node.id)).toEqual(["m2"]);
    expect(tree[0].children[0].children.map((node) => node.id)).toEqual(["m3"]);
    expect(tree[0].depth).toBe(0);
    expect(tree[0].children[0].depth).toBe(1);
    expect(tree[0].children[0].children[0].depth).toBe(2);
    expect(tree[0].children[0].children[0].trail).toEqual(["系统管理", "用户管理"]);
    expect(tree[0].children[0].children[0].ancestorIds).toEqual(["m1", "m2"]);
    expect(flattenNav(tree)).toHaveLength(3);
  });

  it("中间层被隐藏时上挂到最近的可见祖先，且不虚增可见层级", () => {
    const root = menu({ id: "m1", treeCode: "001", name: "系统管理", path: "/system" });
    const hidden = menu({
      id: "m2",
      treeCode: "001001",
      name: "隐藏层",
      path: "/system/hidden",
      visible: false,
    });
    const grandchild = menu({
      id: "m3",
      treeCode: "001001001",
      name: "三级页面",
      path: "/system/hidden/list",
      component: "users",
    });
    const tree = buildNavTree([root, hidden, grandchild]);

    expect(tree).toHaveLength(1);
    expect(tree[0].children.map((node) => node.id)).toEqual(["m3"]);
    expect(tree[0].children[0].depth).toBe(1);
    expect(tree[0].children[0].trail).toEqual(["系统管理"]);
    expect(tree[0].children[0].ancestorIds).toEqual(["m1"]);
  });

  it("停用的菜单完全过滤；未登记组件的内链留在树里但不可导航", () => {
    const disabled = menu({ id: "d", treeCode: "001", name: "停用", path: "/x", enabled: false });
    const unknown = menu({
      id: "u",
      treeCode: "002",
      name: "未登记",
      path: "/unknown",
      component: "not-in-registry",
    });
    const tree = buildNavTree([disabled, unknown]);
    expect(tree).toHaveLength(1);
    expect(tree[0].navigable).toBe(false);
    expect(tree[0].external).toBe(false);
  });

  it("外链节点可直接导航，且不参与站内路径匹配", () => {
    const external = menu({
      id: "e",
      treeCode: "003",
      name: "外部系统",
      path: "https://example.com",
      linkType: 2,
    });
    const tree = buildNavTree([external]);
    expect(tree[0].external).toBe(true);
    expect(tree[0].navigable).toBe(true);
    expect(findNavTrail(tree, "https://example.com")).toBeNull();
  });
});

describe("findNavTrail", () => {
  it("取最长路径匹配，父级不会抢先命中三级菜单", () => {
    const tree = buildNavTree([
      menu({ id: "m1", treeCode: "001", name: "系统管理", path: "/system", component: "dashboard" }),
      menu({
        id: "m2",
        treeCode: "001001",
        name: "用户管理",
        path: "/system/users",
        component: "users",
      }),
      menu({
        id: "m3",
        treeCode: "001001001",
        name: "用户列表",
        path: "/system/users/list",
        component: "users",
      }),
    ]);
    const matched = findNavTrail(tree, "/system/users/list/1");
    expect(matched?.node.id).toBe("m3");
    expect(matched?.trail).toEqual(["系统管理", "用户管理"]);
    expect(matched?.ancestorIds).toEqual(["m1", "m2"]);
    expect(findNavTrail(tree, "/system/users")).toEqual(
      expect.objectContaining({ node: expect.objectContaining({ id: "m2" }) }),
    );
    expect(findNavTrail(tree, "/not-exist")).toBeNull();
    // 只有精确根路径才命中 "/"，否则所有页面都会被根菜单抢走
    expect(findNavTrail(tree, "/")).toBeNull();
  });
});

describe("图标白名单", () => {
  it("ICON_NAMES 有序且可用于校验，iconOf 对未知名回落", () => {
    expect(ICON_NAMES).toContain("users");
    expect([...ICON_NAMES]).toEqual([...ICON_NAMES].sort());
    expect(iconOf("users")).toBe(iconOf("users"));
    expect(iconOf("no-such-icon")).toBe(iconOf(undefined));
  });
});
