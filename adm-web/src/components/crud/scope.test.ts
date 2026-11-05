import { describe, expect, it } from "vitest";
import {
  effectiveScopeValue,
  initialScopeValue,
  scopeCreateValue,
  scopeIndent,
  scopePanelVisible,
  treeGroupQuery,
} from "@/components/crud/scope";
import type { CrudScopeDef } from "@/components/crud/scope";

function scope(overrides: Partial<CrudScopeDef> = {}): CrudScopeDef {
  return {
    title: "应用",
    param: "app_id",
    field: "appId",
    options: [
      { value: "a", label: "甲" },
      { value: "b", label: "乙" },
    ],
    ...overrides,
  };
}

describe("scopePanelVisible", () => {
  it("未配置时不显示", () => {
    expect(scopePanelVisible(undefined)).toBe(false);
  });

  it("默认只在两个及以上选项时显示（0/1 个应用不分组）", () => {
    expect(scopePanelVisible(scope({ options: [] }))).toBe(false);
    expect(scopePanelVisible(scope({ options: [{ value: "a", label: "甲" }] }))).toBe(false);
    expect(scopePanelVisible(scope())).toBe(true);
  });

  it("hideWhenSingle=false 时只要有一个选项就显示", () => {
    expect(scopePanelVisible(scope({ options: [{ value: "a", label: "甲" }], hideWhenSingle: false }))).toBe(true);
    expect(scopePanelVisible(scope({ options: [], hideWhenSingle: false }))).toBe(false);
  });
});

describe("initialScopeValue", () => {
  it("默认恒为「全部」——分组栏隐藏时绝不能隐式收窄", () => {
    expect(initialScopeValue(undefined)).toBeNull();
    // 只有一个选项（分组栏隐藏）也不能默认选中它，否则用户看不到筛选入口却只看到部分数据
    expect(initialScopeValue(scope({ options: [{ value: "a", label: "甲" }] }))).toBeNull();
    expect(initialScopeValue(scope())).toBeNull();
  });
});

describe("effectiveScopeValue", () => {
  it("分组栏不可见时恒为全部，即使调用方传了选中值", () => {
    const single = scope({ options: [{ value: "a", label: "甲" }] });
    expect(effectiveScopeValue(single, "a")).toBeNull();
    expect(effectiveScopeValue(undefined, "a")).toBeNull();
  });

  it("可见时保留有效选择", () => {
    expect(effectiveScopeValue(scope(), "a")).toBe("a");
  });

  it("null / 空串表示全部", () => {
    expect(effectiveScopeValue(scope(), null)).toBeNull();
    expect(effectiveScopeValue(scope(), "")).toBeNull();
  });

  it("选项被删除后回落为全部，不让列表停在永远查不到数据的范围", () => {
    expect(effectiveScopeValue(scope(), "已删除")).toBeNull();
  });
});

describe("scopeCreateValue", () => {
  it("优先当前范围，否则取第一个分组", () => {
    expect(scopeCreateValue(scope(), "b")).toBe("b");
    expect(scopeCreateValue(scope(), null)).toBe("a");
    expect(scopeCreateValue(scope({ options: [] }), null)).toBe("");
    expect(scopeCreateValue(undefined, null)).toBe("");
  });
});

describe("scopeIndent", () => {
  it("按每层 3 位推导缩进，平级分组不缩进", () => {
    expect(scopeIndent({ value: "a", label: "甲" })).toBe(0);
    expect(scopeIndent({ value: "a", label: "甲", treeCode: "001" })).toBe(0);
    expect(scopeIndent({ value: "a", label: "甲", treeCode: "001001" })).toBe(1);
    expect(scopeIndent({ value: "a", label: "甲", treeCode: "001001001" })).toBe(2);
  });
});

describe("treeGroupQuery", () => {
  const groups = [
    { id: "g1", treeCode: "001", realmId: "r1" },
    { id: "g2", treeCode: "001001", realmId: "r1" },
    { id: "g3", treeCode: "001002", realmId: "r1" },
    { id: "g4", treeCode: "002", realmId: "r1" },
    // 另一个领域的同编码分组：不能因为 treeCode 相同被误纳
    { id: "x1", treeCode: "001001", realmId: "r2" },
  ];

  it("选中父分组时展开为本组 + 同领域所有子孙，走 Bean Searcher 的 il 运算符", () => {
    const params = treeGroupQuery("group_id", "g1", groups);
    expect(params["group_id-op"]).toBe("il");
    expect([params["group_id-0"], params["group_id-1"], params["group_id-2"]]).toEqual(["g1", "g2", "g3"]);
    expect(params["group_id-3"]).toBeUndefined();
  });

  it("跨领域同编码分组不会串进来", () => {
    // g2 在 r1 下没有子孙；r2 的 x1 虽然 treeCode 相同，但不是同一个领域，必须排除
    expect(treeGroupQuery("group_id", "g2", groups)).toEqual({ group_id: "g2" });
  });

  it("未知分组退化成等值查询", () => {
    expect(treeGroupQuery("group_id", "nope", groups)).toEqual({ group_id: "nope" });
  });

  it("前缀必须按整层对齐，脏编码 0010 不算 001 的子孙", () => {
    const dirty = [
      { id: "g1", treeCode: "001", realmId: "r1" },
      { id: "bad", treeCode: "0010", realmId: "r1" },
      { id: "ok", treeCode: "001001", realmId: "r1" },
    ];
    const params = treeGroupQuery("group_id", "g1", dirty);
    const ids = [params["group_id-0"], params["group_id-1"]].filter(Boolean);
    expect(ids).toContain("ok");
    expect(ids).not.toContain("bad");
  });
});
