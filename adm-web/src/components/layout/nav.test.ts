import { describe, expect, it, vi } from "vitest";
import type { AdmMenuVo } from "@/lib/types";
import {
  buildNavSections,
  buildNavTree,
  findNavTrail,
  flattenNav,
  ICON_NAMES,
  iconOf,
  pruneNav,
  sectionNodes,
} from "@/components/layout/nav";

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

describe("pruneNav", () => {
  it("自底向上剪掉「不可点且无可见后代」的目录", () => {
    const tree = buildNavTree([
      // 纯空目录：剪掉
      menu({ id: "d1", treeCode: "001", name: "空目录", path: "" }),
      // 目录里只有空子目录：父目录也跟着变空壳，一起剪掉
      menu({ id: "d2", treeCode: "002", name: "外层目录", path: "" }),
      menu({ id: "d3", treeCode: "002001", name: "内层空目录", path: "" }),
      // 目录里有可点页面：保留
      menu({ id: "d4", treeCode: "003", name: "有内容的目录", path: "" }),
      menu({ id: "p1", treeCode: "003001", name: "页面", path: "/page", component: "users" }),
    ]);
    const pruned = pruneNav(tree);
    expect(pruned.map((node) => node.id)).toEqual(["d4"]);
    expect(pruned[0].children.map((node) => node.id)).toEqual(["p1"]);
  });

  it("本身可点的节点即使没有子节点也保留", () => {
    const tree = buildNavTree([menu({ id: "p", treeCode: "001", name: "页面", path: "/p", component: "users" })]);
    expect(pruneNav(tree).map((node) => node.id)).toEqual(["p"]);
  });
});

describe("buildNavSections", () => {
  const apps = [
    { id: "app-b", name: "运营后台", sortOrder: 1 },
    { id: "app-a", name: "管理后台", sortOrder: 2 },
  ];

  it("没有可见菜单时不产生任何分段", () => {
    expect(buildNavSections([], apps)).toEqual([]);
    expect(
      buildNavSections([menu({ id: "h", treeCode: "001", name: "隐藏", path: "/h", visible: false })], apps),
    ).toEqual([]);
  });

  it("只有一个应用时不显示分组头，合并成一段", () => {
    const sections = buildNavSections(
      [
        menu({ id: "a1", appId: "app-a", treeCode: "001", name: "用户", path: "/users", component: "users" }),
        menu({ id: "a2", appId: "app-a", treeCode: "002", name: "角色", path: "/roles", component: "roles" }),
      ],
      apps,
    );
    expect(sections).toHaveLength(1);
    expect(sections[0].showHeader).toBe(false);
    expect(sections[0].id).toBe("__all__");
    expect(sections[0].nodes.map((node) => node.id)).toEqual(["a1", "a2"]);
  });

  it("两个及以上应用时按调用方给出的顺序分段，并前置应用名到面包屑", () => {
    const sections = buildNavSections(
      [
        menu({ id: "a1", appId: "app-a", treeCode: "001", name: "用户", path: "/users", component: "users" }),
        menu({
          id: "b1",
          appId: "app-b",
          treeCode: "001",
          name: "订单",
          path: "/orders",
          component: "users",
        }),
        menu({
          id: "b2",
          appId: "app-b",
          treeCode: "001001",
          name: "订单详情",
          path: "/orders/detail",
          component: "users",
        }),
      ],
      apps,
    );
    // apps 顺序是 运营后台(app-b) → 管理后台(app-a)，与字典序相反，必须按 sort_order 走
    expect(sections.map((section) => section.id)).toEqual(["app-b", "app-a"]);
    expect(sections.map((section) => section.label)).toEqual(["运营后台", "管理后台"]);
    expect(sections.every((section) => section.showHeader)).toBe(true);
    const detail = sections[0].nodes[0].children[0];
    expect(detail.trail).toEqual(["运营后台", "订单"]);
    // sectionNodes 只展平「分段」这一层，子节点要靠 flattenNav 才展开
    expect(sectionNodes(sections)).toHaveLength(2);
    expect(flattenNav(sectionNodes(sections))).toHaveLength(3);
  });

  it("某应用剪枝后为空则整段隐藏；缺应用信息时回退为短 ID 标签", () => {
    const sections = buildNavSections(
      [
        // app-empty 只有一个空目录 → 整段消失
        menu({ id: "e1", appId: "app-empty", treeCode: "001", name: "空目录", path: "" }),
        menu({ id: "a1", appId: "app-a", treeCode: "001", name: "用户", path: "/users", component: "users" }),
      ],
      apps,
    );
    expect(sections.map((section) => section.id)).toEqual(["app-a"]);

    const unknown = buildNavSections(
      [
        menu({ id: "u1", appId: "app-x", treeCode: "001", name: "甲", path: "/a", component: "users" }),
        menu({ id: "u2", appId: "app-y", treeCode: "001", name: "乙", path: "/b", component: "users" }),
      ],
      [],
    );
    expect(unknown).toHaveLength(2);
    // 没有应用信息也不能崩，标签退化为「应用 <短 ID>」
    expect(unknown[0].label).toContain("应用 ");
  });

  it("被隐藏菜单所属的应用不参与分段判断", () => {
    const sections = buildNavSections(
      [
        menu({ id: "a1", appId: "app-a", treeCode: "001", name: "用户", path: "/users", component: "users" }),
        menu({
          id: "b1",
          appId: "app-b",
          treeCode: "001",
          name: "隐藏",
          path: "/hidden",
          component: "users",
          visible: false,
        }),
      ],
      apps,
    );
    expect(sections).toHaveLength(1);
    expect(sections[0].showHeader).toBe(false);
  });
});
