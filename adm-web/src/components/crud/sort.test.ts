import { describe, expect, it } from "vitest";
import {
  applySortPreview,
  buildSortOrderMap,
  buildSortSequence,
  moveSortIdTo,
  parentTreeCode,
  sortGroupKey,
  swapSortId,
} from "./sort";

interface Row {
  id: string;
  sortOrder: number;
  treeCode: string;
  groupId: string;
}

const numberRows: Row[] = [
  { id: "1", sortOrder: 2, treeCode: "", groupId: "g1" },
  { id: "2", sortOrder: 0, treeCode: "", groupId: "g1" },
  { id: "3", sortOrder: 1, treeCode: "", groupId: "g2" },
  { id: "4", sortOrder: 1, treeCode: "", groupId: "g1" },
];

const treeRows: Row[] = [
  { id: "a", sortOrder: 0, treeCode: "001", groupId: "g1" },
  { id: "b", sortOrder: 0, treeCode: "002", groupId: "g1" },
  { id: "c", sortOrder: 0, treeCode: "001001", groupId: "g1" },
  { id: "d", sortOrder: 0, treeCode: "001002", groupId: "g1" },
  { id: "e", sortOrder: 0, treeCode: "002001", groupId: "g1" },
];

describe("sort helpers", () => {
  it("按每层 3 位取父编码，根节点为空串", () => {
    expect(parentTreeCode("001001")).toBe("001");
    expect(parentTreeCode("002")).toBe("");
    expect(parentTreeCode("")).toBe("");
  });

  it("数字实体按外层 scope 分组，树形实体按 scope + 父节点分组", () => {
    const numberSort = { kind: "number" as const, orderValue: (row: Row) => row.sortOrder, scope: (row: Row) => row.groupId };
    expect(sortGroupKey(numberRows[0], numberSort)).toBe("g1");
    expect(sortGroupKey(numberRows[2], numberSort)).toBe("g2");

    const treeSort = { kind: "tree" as const, treeCode: (row: Row) => row.treeCode, scope: (row: Row) => row.groupId };
    expect(sortGroupKey(treeRows[0], treeSort)).toBe("g1#");
    expect(sortGroupKey(treeRows[2], treeSort)).toBe("g1#001");
  });

  it("推导组内完整顺序，不跨组、不重复", () => {
    const sortable = { kind: "number" as const, orderValue: (row: Row) => row.sortOrder, scope: (row: Row) => row.groupId };
    const map = buildSortOrderMap(numberRows, sortable);
    expect(map.get("g1")).toEqual(["2", "4", "1"]);
    expect(map.get("g2")).toEqual(["3"]);

    const treeSortable = { kind: "tree" as const, treeCode: (row: Row) => row.treeCode, scope: (row: Row) => row.groupId };
    const treeMap = buildSortOrderMap(treeRows, treeSortable);
    expect(treeMap.get("g1#")).toEqual(["a", "b"]);
    expect(treeMap.get("g1#001")).toEqual(["c", "d"]);
  });

  it("生成组内序号", () => {
    const sequence = buildSortSequence(
      new Map([
        ["g1", ["2", "4", "1"]],
        ["g2", ["3"]],
      ]),
    );
    expect(sequence.get("2")).toBe(1);
    expect(sequence.get("4")).toBe(2);
    expect(sequence.get("1")).toBe(3);
    expect(sequence.get("3")).toBe(1);
  });

  it("乐观预览只影响对应分组，其他分组保持原位置", () => {
    const sortable = { kind: "number" as const, orderValue: (row: Row) => row.sortOrder, scope: (row: Row) => row.groupId };
    const preview = { g1: ["1", "2", "4"] };
    expect(applySortPreview(numberRows, sortable, preview).map((row) => row.id)).toEqual(["1", "2", "3", "4"]);
  });

  it("上移/下移越界返回 null，否则交换相邻项", () => {
    expect(swapSortId(["1", "2", "3"], "1", -1)).toBeNull();
    expect(swapSortId(["1", "2", "3"], "3", 1)).toBeNull();
    expect(swapSortId(["1", "2", "3"], "2", -1)).toEqual(["2", "1", "3"]);
  });

  it("拖拽把源移动到目标下标", () => {
    expect(moveSortIdTo(["1", "2", "3"], "1", 2)).toEqual(["2", "3", "1"]);
    expect(moveSortIdTo(["1", "2", "3"], "3", 0)).toEqual(["3", "1", "2"]);
  });
});
