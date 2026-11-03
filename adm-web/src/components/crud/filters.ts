/**
 * CrudPage 搜索行的筛选 schema、状态与查询参数拼装。
 *
 * 扩展点：新增筛选控件时只需在 {@link CrudFilterDef} 的联合类型里加一个分支，
 * 并在这里补上 `buildFilterParams` 的序列化规则；页面侧只声明 schema，不写请求拼装。
 *
 * 后端契约（`adm-svr` / robotech）：
 * - `${prefix}/page` 走 QueryDto，只支持等值字段；
 * - `${prefix}/search/page` 走 Bean Searcher 参数，支持 `字段-op` 运算符，
 *   例如 `login_ms-op=bt&login_ms-0=...&login_ms-1=...`。
 * 因此带运算符的筛选统一由 `search/page` 承载（见 lib/api 的 `searchPage`）。
 */

import type { PageQuery } from "@/lib/types";

/** 筛选控件类型。 */
export type CrudFilterType = "keyword" | "select" | "boolean" | "date-range" | "entity";

export interface CrudFilterOption {
  value: string;
  label: string;
}

/** 日期范围控件的 UI 状态：两端都可单独留空。 */
export interface CrudDateRange {
  start?: string;
  end?: string;
}

/** 筛选状态的统一值类型（keyword 不落在这里，见下方说明）。 */
export type CrudFilterValue = string | CrudDateRange | undefined;

/** 按筛选 name 索引的 UI 状态。 */
export type CrudFilterValues = Record<string, CrudFilterValue>;

/**
 * 搜索行筛选定义（判别联合）。
 *
 * - `keyword`：声明内置关键字搜索框的参数名 / 占位文案；不占筛选状态，值是独立输入框。
 * - `select`：后端等值枚举，`name` 即数据库列名（如 `status`）。
 * - `boolean`：后端布尔列，发出 `true` / `false`。
 * - `date-range`：按 `name` 指定的毫秒时间戳列发出 `bt` / `ge` / `le`
 *   （两端都选 → `bt`，只选开始 → `ge`，只选结束 → `le`）。
 * - `entity`：关联实体选择，等值查询；选项可静态给 `options`，也可给异步 `loadOptions`。
 *
 * 新增页面照抄示例：
 * ```tsx
 * filters={[
 *   { type: "select", name: "status", label: "状态", options: [...] },
 *   { type: "boolean", name: "enabled", label: "启用" },
 *   { type: "date-range", name: "create_ms", label: "创建时间" },
 *   { type: "entity", name: "user_id", label: "用户", loadOptions: loadUsers },
 * ]}
 * ```
 */
export type CrudFilterDef =
  | {
      type: "keyword";
      /** 查询参数名，默认 `_keyword`。 */
      name?: string;
      label?: string;
      placeholder?: string;
    }
  | {
      type: "select";
      /** 后端字段名，同时作为 UI 状态 key。 */
      name: string;
      label: string;
      options: CrudFilterOption[];
    }
  | {
      type: "boolean";
      name: string;
      label: string;
    }
  | {
      type: "date-range";
      /** 后端毫秒时间戳字段名。 */
      name: string;
      label: string;
    }
  | {
      type: "entity";
      /** 后端外键字段名。 */
      name: string;
      label: string;
      /** 静态选项；与 `loadOptions` 二选一，静态优先。 */
      options?: CrudFilterOption[];
      /** 异步选项加载（例如关联用户列表）。 */
      loadOptions?: () => Promise<CrudFilterOption[]>;
    };

/** 空筛选状态。 */
export const EMPTY_FILTER_VALUES: CrudFilterValues = {};

/** 取关键字筛选的查询参数名（默认 `_keyword`）。 */
export function keywordParamName(filters?: CrudFilterDef[]): string {
  const def = filters?.find((item) => item.type === "keyword");
  return def?.type === "keyword" ? def.name ?? "_keyword" : "_keyword";
}

/** 取关键字筛选的占位文案（未声明时回退到页面传入的 searchPlaceholder）。 */
export function keywordPlaceholder(
  filters: CrudFilterDef[] | undefined,
  fallback: string,
): string {
  const def = filters?.find((item) => item.type === "keyword");
  return def?.type === "keyword" ? def.placeholder ?? fallback : fallback;
}

function isDateRange(value: CrudFilterValue): value is CrudDateRange {
  return typeof value === "object" && value !== null;
}

/** 单个筛选是否处于激活状态；空字符串、空日期、未选都算未激活。 */
export function isFilterActive(def: CrudFilterDef, value: CrudFilterValue): boolean {
  if (def.type === "keyword") return false;
  if (def.type === "date-range") {
    if (!isDateRange(value)) return false;
    return Boolean(value.start || value.end);
  }
  return typeof value === "string" && value !== "";
}

/** 搜索行里是否存在任意激活的非关键字筛选。 */
export function hasActiveFilterValues(
  filters: CrudFilterDef[] | undefined,
  values: CrudFilterValues,
): boolean {
  return (filters ?? []).some(
    (def) => def.type !== "keyword" && isFilterActive(def, values[def.name]),
  );
}

/** 解析并校验 `YYYY-MM-DD`，拒绝 2026-13-01 这类溢出日期。 */
function parseDate(date: string | undefined): { year: number; month: number; day: number } | undefined {
  if (!date) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(year, month - 1, day);
  if (check.getFullYear() !== year || check.getMonth() !== month - 1 || check.getDate() !== day) {
    return undefined;
  }
  return { year, month, day };
}

/** 把 `YYYY-MM-DD` 解析成本地时区当天 00:00:00.000 的毫秒数。 */
export function startOfDayMs(date: string | undefined): number | undefined {
  const parts = parseDate(date);
  if (!parts) return undefined;
  return new Date(parts.year, parts.month - 1, parts.day).getTime();
}

/** 把 `YYYY-MM-DD` 解析成本地时区当天 23:59:59.999 的毫秒数。 */
export function endOfDayMs(date: string | undefined): number | undefined {
  const parts = parseDate(date);
  if (!parts) return undefined;
  return new Date(parts.year, parts.month - 1, parts.day, 23, 59, 59, 999).getTime();
}

/**
 * 把筛选状态序列化成后端可识别的 query 参数。
 *
 * - 未激活的筛选不写参数（不会把 `""` 传给后端）。
 * - 日期范围按 `bt` / `ge` / `le` 三种运算符输出；后端 `SearchParams` 据此构建条件。
 * - keyword 不在这里处理：它是独立输入框，由 CrudPage 用 `keywordParamName` 拼装。
 */
export function buildFilterParams(
  filters: CrudFilterDef[] | undefined,
  values: CrudFilterValues,
): PageQuery {
  const params: PageQuery = {};
  for (const def of filters ?? []) {
    // keyword 是独立输入框，没有筛选状态，也不需要拼参数。
    if (def.type === "keyword") continue;
    const value = values[def.name];
    switch (def.type) {
      case "select":
      case "entity": {
        if (typeof value === "string" && value !== "") params[def.name] = value;
        break;
      }
      case "boolean": {
        if (value === "true" || value === "false") params[def.name] = value === "true";
        break;
      }
      case "date-range": {
        if (!isDateRange(value)) break;
        const start = startOfDayMs(value.start);
        const end = endOfDayMs(value.end);
        if (start !== undefined && end !== undefined) {
          params[`${def.name}-op`] = "bt";
          params[`${def.name}-0`] = start;
          params[`${def.name}-1`] = end;
        } else if (start !== undefined) {
          params[`${def.name}-op`] = "ge";
          params[`${def.name}-0`] = start;
        } else if (end !== undefined) {
          params[`${def.name}-op`] = "le";
          params[`${def.name}-0`] = end;
        }
        break;
      }
    }
  }
  return params;
}
