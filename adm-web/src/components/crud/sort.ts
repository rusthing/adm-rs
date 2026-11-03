/**
 * 通用排序列的前端纯函数。
 *
 * 服务端已经负责分配与持久化排序值，这里只负责：
 * 1. 从全量列表推导每个分组的完整 id 顺序；
 * 2. 在页面上做乐观重排；
 * 3. 为提交接口生成「同组完整顺序」。
 */

export type CrudSortKind = "number" | "tree";

export interface CrudSortable<T> {
  /** `number` 走 `sort_order`；`tree` 走 `tree_code`。 */
  kind: CrudSortKind;
  /** number：读取排序值 */
  orderValue?: (row: T) => number;
  /** tree：读取树编码 */
  treeCode?: (row: T) => string;
  /**
   * 分组隔离键：数字实体通常为 `realmId` / `groupId`；
   * 树形实体为 `appId` / `realmId`；不声明时整页视为一组。
   */
  scope?: (row: T) => string | null | undefined;
  /** 拉取全量列表时使用的排序，缺省沿用页面 `defaultOrderBy`。 */
  listOrderBy?: string;
}

/** 取父节点编码：`001001` → `001`，根节点 → 空串。 */
export function parentTreeCode(code: string | null | undefined): string {
  if (!code || code.length < 3) return "";
  return code.slice(0, code.length - 3);
}

/** 同一分组才能互换；树形实体按「外层隔离域 + 父节点」分组。 */
export function sortGroupKey<T>(row: T, sortable: CrudSortable<T>): string {
  const scope = sortable.scope?.(row) ?? "";
  if (sortable.kind === "tree") {
    return `${scope}#${parentTreeCode(sortable.treeCode?.(row))}`;
  }
  return String(scope);
}

function compareId(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true });
}

function compareRows<T>(a: T, b: T, sortable: CrudSortable<T>): number {
  if (sortable.kind === "tree") {
    return (sortable.treeCode?.(a) ?? "").localeCompare(sortable.treeCode?.(b) ?? "");
  }
  const diff = (sortable.orderValue?.(a) ?? 0) - (sortable.orderValue?.(b) ?? 0);
  return diff;
}

/**
 * 推断每个分组的完整 id 顺序（与服务端当前存储顺序一致）。
 * 入参应是未分页的全量列表。
 */
export function buildSortOrderMap<T extends { id: string }>(
  rows: T[],
  sortable: CrudSortable<T>,
): Map<string, string[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = sortGroupKey(row, sortable);
    const list = groups.get(key);
    if (list) list.push(row);
    else groups.set(key, [row]);
  }

  const result = new Map<string, string[]>();
  for (const [key, groupRows] of groups) {
    const sorted = [...groupRows].sort((a, b) => compareRows(a, b, sortable) || compareId(a.id, b.id));
    result.set(
      key,
      sorted.map((row) => row.id),
    );
  }
  return result;
}

/** 生成 id → 组内序号（从 1 开始）的映射。 */
export function buildSortSequence(orderMap: Map<string, string[]>): Map<string, number> {
  const sequence = new Map<string, number>();
  for (const ids of orderMap.values()) {
    ids.forEach((id, index) => sequence.set(id, index + 1));
  }
  return sequence;
}

/**
 * 把预览顺序套到当前页：只重排被预览的分组，保持其他分组在原位。
 * 失败回滚时清空 preview 即可。
 */
export function applySortPreview<T extends { id: string }>(
  rows: T[],
  sortable: CrudSortable<T>,
  preview: Record<string, string[]>,
): T[] {
  const keys = Object.keys(preview);
  if (keys.length === 0) return rows;

  let result = [...rows];
  for (const key of keys) {
    const groupRows = result.filter((row) => sortGroupKey(row, sortable) === key);
    if (groupRows.length === 0) continue;
    const rank = new Map(preview[key].map((id, index) => [id, index]));
    const sorted = [...groupRows].sort(
      (a, b) => (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER),
    );
    let cursor = 0;
    result = result.map((row) => (sortGroupKey(row, sortable) === key ? sorted[cursor++] : row));
  }
  return result;
}

/** 上移/下移：与相邻项交换；越界返回 null。 */
export function swapSortId(ids: string[], sourceId: string, delta: number): string[] | null {
  const from = ids.indexOf(sourceId);
  const target = from + delta;
  if (from < 0 || target < 0 || target >= ids.length) return null;
  const next = [...ids];
  [next[from], next[target]] = [next[target], next[from]];
  return next;
}

/** 拖拽：把 sourceId 移动到 targetIndex（原列表下标）。 */
export function moveSortIdTo(ids: string[], sourceId: string, targetIndex: number): string[] | null {
  const from = ids.indexOf(sourceId);
  if (from < 0) return null;
  const next = ids.filter((id) => id !== sourceId);
  const index = Math.max(0, Math.min(next.length, targetIndex));
  next.splice(index, 0, sourceId);
  return next;
}
