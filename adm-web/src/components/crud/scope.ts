/**
 * CrudPage 左侧分组栏的纯逻辑。
 *
 * 分页列表本身是「平的」，用户要管理的是树/分组：菜单按应用、权限按权限分组、
 * 分组按领域。这里把「是否显示分组栏 / 默认选中哪个分组 / 缩进层级」抽成纯函数，
 * 渲染放在 `./scope-panel.tsx`，逻辑可以直接单测。
 */

import type { PageQuery } from "@/lib/types";

export interface CrudScopeOption {
  value: string;
  label: string;
  /** 树形编码；有值时按层级缩进，平级分组（应用 / 领域）不传。 */
  treeCode?: string;
  /** 副标题，如应用 code、分组 treeCode。 */
  description?: string;
  /** 停用项仍可见，但会打上标记，选中后由页面自行解释。 */
  disabled?: boolean;
}

export interface CrudScopeDef {
  /** 分组栏标题，如「应用」「权限分组」「领域」。 */
  title: string;
  /** 后端筛选参数名（snake_case），如 `app_id` / `group_id` / `realm_id`。 */
  param: string;
  /** 新建表单里对应的字段名（camelCase），如 `appId` / `groupId` / `realmId`。 */
  field: string;
  options: CrudScopeOption[];
  /**
   * 只有 0 / 1 个选项时不渲染分组栏（默认 true）。
   * 用户要求「没有应用或只有一个应用时才不分组」，就是这个开关。
   */
  hideWhenSingle?: boolean;
  loading?: boolean;
  emptyText?: string;
  /** 分组栏底部说明。 */
  hint?: string;
  /**
   * 自定义筛选参数，默认 `{ [param]: value }`。
   * 分组树用它把「选中父分组」扩展成包含所有子分组的 `il` 条件，
   * 否则父分组自身没有权限点时列表会莫名其妙是空的。
   */
  queryFor?: (value: string) => PageQuery;
}

/** 分组栏是否需要渲染：默认只在有两个及以上选项时出现。 */
export function scopePanelVisible(scope?: CrudScopeDef): boolean {
  if (!scope) return false;
  const hideWhenSingle = scope.hideWhenSingle ?? true;
  return hideWhenSingle ? scope.options.length > 1 : scope.options.length > 0;
}

/**
 * 未被用户改动时的默认范围恒为「全部」（null，不加筛选参数）。
 *
 * ⚠️ 这里**不能**因为「分组栏隐藏且恰好一个选项」就默认收窄到它：
 * 分组栏隐藏时用户看不到任何筛选入口，也就无法取消；一旦选项列表还在加载、
 * 或者存在 appId/realmId 为空、指向已删除分组的历史数据，这些记录会凭空消失，
 * 而且列表会随选项加载完成发生一次无声跳变。「只有一个应用」的含义是
 * *不分组展示*，不是*隐式筛选*。新建表单的预填由 `scopeCreateValue` 单独负责。
 */
export function initialScopeValue(_scope?: CrudScopeDef): string | null {
  return null;
}

/**
 * 把用户选择（`null`=自动 / `""`=全部 / 具体值）折算成最终筛选值。
 * 选项被删除或换页重载后，失效的选择自动回落为「全部」，避免列表一直空白。
 */
export function effectiveScopeValue(
  scope: CrudScopeDef | undefined,
  selected: string | null,
): string | null {
  if (!scope || !scopePanelVisible(scope)) return null;
  if (selected === "" || selected === null) return initialScopeValue(scope);
  // 选项被删除或换页重载后回落为「全部」，不让列表停在永远查不到数据的范围上。
  return scope.options.some((option) => option.value === selected)
    ? selected
    : initialScopeValue(scope);
}

/** 新建时预填到表单字段的值：优先当前范围，退而取第一个分组。 */
export function scopeCreateValue(
  scope: CrudScopeDef | undefined,
  effective: string | null,
): string {
  return effective ?? scope?.options[0]?.value ?? "";
}

/** 由 treeCode 推导缩进层级（每层 3 位，根为 0）。 */
export function scopeIndent(option: CrudScopeOption): number {
  return option.treeCode ? Math.max(0, Math.floor(option.treeCode.length / 3) - 1) : 0;
}

/**
 * 把「选中树分组」展开成 `本组 + 同领域所有子孙组` 的 is_in 条件。
 *
 * 父分组自身往往一条数据都没有，只按 group_id 等值查会莫名其妙显示空列表。
 * treeCode 只在领域内唯一，所以必须同时限定 realmId。Bean Searcher 的 `il`
 * 是 is_in 运算符，取值走 `${param}-0`、`${param}-1`…
 */
export function treeGroupQuery(
  param: string,
  value: string,
  groups: Array<{ id: string; treeCode: string; realmId?: string }>,
): PageQuery {
  const target = groups.find((group) => group.id === value);
  if (!target) return { [param]: value };
  const ids = groups
    .filter((group) => {
      if ((group.realmId ?? "") !== (target.realmId ?? "")) return false;
      // 每层 3 位：仅当前缀按整层对齐时才算子孙，避免 "0010" 这类脏编码被误纳。
      const extra = group.treeCode.length - target.treeCode.length;
      return extra >= 0 && extra % 3 === 0 && group.treeCode.startsWith(target.treeCode);
    })
    .map((group) => group.id);
  if (ids.length <= 1) return { [param]: value };
  const params: PageQuery = { [`${param}-op`]: "il" };
  ids.forEach((id, index) => {
    params[`${param}-${index}`] = id;
  });
  return params;
}
