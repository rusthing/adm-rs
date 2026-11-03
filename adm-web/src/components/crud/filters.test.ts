import { describe, expect, it } from "vitest";
import {
  buildFilterParams,
  hasActiveFilterValues,
  isFilterActive,
  keywordParamName,
  keywordPlaceholder,
  startOfDayMs,
  endOfDayMs,
} from "./filters";
import type { CrudFilterDef } from "./filters";

const start = new Date(2026, 10, 1, 0, 0, 0, 0).getTime();
const end = new Date(2026, 10, 2, 23, 59, 59, 999).getTime();

const filters: CrudFilterDef[] = [
  { type: "select", name: "status", label: "状态", options: [] },
  { type: "boolean", name: "enabled", label: "启用" },
  { type: "date-range", name: "create_ms", label: "创建时间" },
  { type: "entity", name: "user_id", label: "用户" },
];

describe("buildFilterParams", () => {
  it("日期范围两端都选时输出 bt 与两个毫秒值", () => {
    expect(buildFilterParams(filters, { create_ms: { start: "2026-11-01", end: "2026-11-02" } })).toEqual({
      "create_ms-op": "bt",
      "create_ms-0": start,
      "create_ms-1": end,
    });
  });

  it("只选开始 / 只选结束时分别降级为 ge / le", () => {
    expect(buildFilterParams(filters, { create_ms: { start: "2026-11-01" } })).toEqual({
      "create_ms-op": "ge",
      "create_ms-0": start,
    });
    expect(buildFilterParams(filters, { create_ms: { end: "2026-11-02" } })).toEqual({
      "create_ms-op": "le",
      "create_ms-0": end,
    });
  });

  it("枚举、布尔、关联实体都按等值输出，布尔保留 false", () => {
    expect(buildFilterParams(filters, { status: "2", enabled: "false", user_id: "42" })).toEqual({
      status: "2",
      enabled: false,
      user_id: "42",
    });
  });

  it("空值、未激活的日期范围不会写入参数", () => {
    expect(buildFilterParams(filters, { status: "", create_ms: { start: "", end: "" } })).toEqual({});
    expect(buildFilterParams(filters, {})).toEqual({});
    expect(buildFilterParams(undefined, { status: "1" })).toEqual({});
  });

  it("keyword 类型不产生额外参数（由搜索框单独拼装）", () => {
    expect(
      buildFilterParams(
        [...filters, { type: "keyword", name: "_keyword", placeholder: "搜索" }],
        { status: "1" },
      ),
    ).toEqual({ status: "1" });
  });
});

describe("筛选激活与关键字声明", () => {
  it("空日期范围不算激活，任一端有值才算", () => {
    const def = filters[2];
    expect(isFilterActive(def, {})).toBe(false);
    expect(isFilterActive(def, { start: "", end: "" })).toBe(false);
    expect(isFilterActive(def, { start: "2026-11-01" })).toBe(true);
    expect(hasActiveFilterValues(filters, { create_ms: { start: "", end: "" } })).toBe(false);
  });

  it("可读取 keyword 声明的参数名与占位文案", () => {
    const keywordFilters: CrudFilterDef[] = [
      { type: "keyword", name: "q", placeholder: "搜索名称" },
    ];
    expect(keywordParamName(keywordFilters)).toBe("q");
    expect(keywordPlaceholder(keywordFilters, "默认")).toBe("搜索名称");
    expect(keywordParamName()).toBe("_keyword");
    expect(keywordPlaceholder(undefined, "默认")).toBe("默认");
  });

  it("日期边界按本地时区取当天首尾", () => {
    expect(startOfDayMs("2026-11-01")).toBe(start);
    expect(endOfDayMs("2026-11-02")).toBe(end);
    expect(startOfDayMs("")).toBeUndefined();
    expect(startOfDayMs("2026-13-01")).toBeUndefined();
  });
});
