import { describe, expect, it } from "vitest";
import { buildTree, flattenTreeIds } from "@/components/crud/tree-utils";

interface Row {
  id: string;
  name: string;
  treeCode: string;
  enabled: boolean;
  appId?: string;
}

function row(overrides: Partial<Row> & Pick<Row, "id" | "treeCode">): Row {
  return { name: overrides.id, enabled: true, ...overrides };
}

describe("buildTree", () => {
  it("按 treeCode 前缀还原层级并写入真实 depth", () => {
    const tree = buildTree([
      row({ id: "c", treeCode: "001001001" }),
      row({ id: "a", treeCode: "001" }),
      row({ id: "b", treeCode: "001001" }),
    ]);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("a");
    expect(tree[0].depth).toBe(0);
    expect(tree[0].children?.map((node) => node.id)).toEqual(["b"]);
    expect(tree[0].children?.[0].depth).toBe(1);
    expect(tree[0].children?.[0].children?.[0].id).toBe("c");
    expect(tree[0].children?.[0].children?.[0].depth).toBe(2);
  });

  it("中间层缺失时挂到最近的可见祖先，不按编码长度虚增层级", () => {
    const tree = buildTree([row({ id: "a", treeCode: "001" }), row({ id: "c", treeCode: "001001001" })]);
    expect(tree).toHaveLength(1);
    expect(tree[0].children?.map((node) => node.id)).toEqual(["c"]);
    expect(tree[0].children?.[0].depth).toBe(1);
  });

  it("scopeOf 隔离作用域：跨应用的同编码节点不会互相认父", () => {
    const menus = [
      row({ id: "a1", treeCode: "001", appId: "app-a" }),
      row({ id: "a2", treeCode: "001001", appId: "app-a" }),
      row({ id: "b1", treeCode: "001", appId: "app-b" }),
      row({ id: "b2", treeCode: "001001", appId: "app-b" }),
    ];
    const tree = buildTree(menus, (item) => item.appId);
    // 两个应用各自成一棵树，不能合并
    expect(tree.map((node) => node.id)).toEqual(["a1", "b1"]);
    expect(tree[0].children?.map((node) => node.id)).toEqual(["a2"]);
    expect(tree[1].children?.map((node) => node.id)).toEqual(["b2"]);
  });

  it("不修改入参（React Query 缓存对象不能挂 children）", () => {
    const input = [row({ id: "a", treeCode: "001" }), row({ id: "b", treeCode: "001001" })];
    buildTree(input);
    for (const item of input) {
      expect(item).not.toHaveProperty("children");
      expect(item).not.toHaveProperty("depth");
    }
  });

  it("同级按 treeCode 再按 id 稳定排序", () => {
    const tree = buildTree([
      row({ id: "z", treeCode: "002" }),
      row({ id: "y", treeCode: "001" }),
      row({ id: "x", treeCode: "002" }),
    ]);
    expect(tree.map((node) => node.id)).toEqual(["y", "x", "z"]);
  });
});

describe("flattenTreeIds", () => {
  it("深度优先收集所有节点 id，含子孙", () => {
    const tree = buildTree([
      row({ id: "a", treeCode: "001" }),
      row({ id: "a1", treeCode: "001001" }),
      row({ id: "a2", treeCode: "001002" }),
      row({ id: "a11", treeCode: "001001001" }),
      row({ id: "b", treeCode: "002" }),
    ]);
    expect(flattenTreeIds(tree)).toEqual(["a", "a1", "a11", "a2", "b"]);
  });

  it("空树返回空数组", () => {
    expect(flattenTreeIds([])).toEqual([]);
  });
});
