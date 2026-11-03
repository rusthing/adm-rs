import { describe, expect, it } from "vitest";
import { EMPTY_CELL, formatCellText, isEmptyCellValue } from "./cells";

describe("isEmptyCellValue", () => {
  it("null / undefined / 空字符串 / 空白字符串都算空", () => {
    expect(isEmptyCellValue(null)).toBe(true);
    expect(isEmptyCellValue(undefined)).toBe(true);
    expect(isEmptyCellValue("")).toBe(true);
    expect(isEmptyCellValue("   ")).toBe(true);
  });

  it("false 与 0 不算空", () => {
    expect(isEmptyCellValue(false)).toBe(false);
    expect(isEmptyCellValue(0)).toBe(false);
    expect(isEmptyCellValue("0")).toBe(false);
  });
});

describe("formatCellText", () => {
  it("所有空值统一显示 --", () => {
    expect(formatCellText(null)).toBe(EMPTY_CELL);
    expect(formatCellText(undefined, "datetime")).toBe(EMPTY_CELL);
    expect(formatCellText("", "text")).toBe(EMPTY_CELL);
  });

  it("布尔默认是 / 否，且支持自定义文案", () => {
    expect(formatCellText(true, "boolean")).toBe("是");
    expect(formatCellText(false, "boolean")).toBe("否");
    expect(formatCellText(true, "boolean", { on: "启用", off: "停用" })).toBe("启用");
  });

  it("数字 0 正常输出", () => {
    expect(formatCellText(0, "number")).toBe("0");
  });

  it("毫秒时间戳格式化，非法值回退 --", () => {
    expect(formatCellText("1700000000000", "datetime")).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
    expect(formatCellText("abc", "datetime")).toBe(EMPTY_CELL);
  });

  it("长 ID 缩短展示，短 ID 原样展示", () => {
    expect(formatCellText("1234567890123456789", "id")).toBe("123456…6789");
    expect(formatCellText("123", "id")).toBe("123");
  });

  it("code 类型空值同样回退 --", () => {
    expect(formatCellText("", "code")).toBe(EMPTY_CELL);
    expect(formatCellText("users", "code")).toBe("users");
  });
});
