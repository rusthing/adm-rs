/**
 * 列表单元格的统一格式化与渲染。
 *
 * 扩展点：
 * 1. 先在这里的 {@link CrudCellType} 里加类型；
 * 2. 在 `formatCellText` 里补文本规则；
 * 3. 需要特殊样式时在 `CellValue` 里加分支。
 *
 * 页面侧只写 `type: "datetime" | "boolean" | "id" ...`，不要每页自己调 `formatMs`。
 * 自定义列（如状态徽标）仍可用 `CrudColumn.render` 覆盖。
 */
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/primitives";
import { boolText, formatDate, formatMs, shortId } from "@/lib/utils";

export type CrudCellType = "text" | "code" | "datetime" | "date" | "boolean" | "id" | "number";

/** 空值统一占位符。 */
export const EMPTY_CELL = "--";

/** null / undefined / 空白字符串都视为空；`false` 与 `0` 不算空。 */
export function isEmptyCellValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  return false;
}

export interface BooleanCellLabels {
  on: string;
  off: string;
}

export const DEFAULT_BOOLEAN_LABELS: BooleanCellLabels = { on: "是", off: "否" };

/**
 * 单元格文本格式化（纯函数，便于单测）。
 * 空值和非法日期都返回 {@link EMPTY_CELL}。
 */
export function formatCellText(
  value: unknown,
  type: CrudCellType = "text",
  booleanLabels: BooleanCellLabels = DEFAULT_BOOLEAN_LABELS,
): string {
  if (isEmptyCellValue(value)) return EMPTY_CELL;
  switch (type) {
    case "datetime":
      return formatMs(value as string | number);
    case "date":
      return formatDate(value as string | number);
    case "boolean":
      return boolText(Boolean(value), booleanLabels.on, booleanLabels.off);
    case "id":
      return shortId(String(value));
    case "number":
    case "code":
    case "text":
    default:
      return String(value);
  }
}

/** 默认单元格渲染；`render` 为空时由 CrudPage 调用。 */
export function CellValue({
  value,
  type = "text",
  booleanLabels,
}: {
  value: unknown;
  type?: CrudCellType;
  booleanLabels?: BooleanCellLabels;
}): ReactNode {
  if (isEmptyCellValue(value)) return <span className="text-muted">{EMPTY_CELL}</span>;

  switch (type) {
    case "datetime":
    case "date": {
      const text = formatCellText(value, type);
      return text === EMPTY_CELL ? (
        <span className="text-muted">{text}</span>
      ) : (
        <span className="font-mono">{text}</span>
      );
    }
    case "boolean":
      return (
        <Badge tone={value ? "success" : "warn"}>
          {formatCellText(value, "boolean", booleanLabels ?? DEFAULT_BOOLEAN_LABELS)}
        </Badge>
      );
    case "id":
      return (
        <code className="font-mono text-[11.5px] text-muted" title={String(value)}>
          {formatCellText(value, "id")}
        </code>
      );
    case "number":
      return <span className="tnum">{String(value)}</span>;
    case "code":
      return (
        <code className="font-mono text-[11.5px] text-muted" title={String(value)}>
          {String(value)}
        </code>
      );
    case "text":
    default:
      return String(value);
  }
}
