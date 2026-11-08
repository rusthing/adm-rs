import { useMemo, useState } from "react";
import type { AdmMenuVo, AdmPermGroupVo, AdmPermVo, AdmRoleGroupVo } from "@/lib/types";
import { shortId } from "@/lib/utils";
import { Badge, Checkbox } from "@/components/ui/primitives";
import { ChevronDown, ChevronRight, FolderTree } from "lucide-react";
import { useAppOptions, usePermGroupOptions, useRoleGroupOptions } from "@/lib/queries";
import { buildTree, flattenTreeIds } from "./tree-utils";
import type { TreeItem, TreeNode } from "./tree-utils";

export type { TreeItem, TreeNode } from "./tree-utils";
export { buildTree, flattenTreeIds } from "./tree-utils";

/* ----------------------------- tree select UI ----------------------------- */

export function TreeCheckboxGroup<T extends TreeNode>({
  items,
  selected,
  onToggle,
  onSetMany,
  depthIndent = 18,
  checkable = true,
}: {
  items: TreeItem<T>[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  /**
   * 父子级联：勾选/取消一个节点时一次性设置它和全部子孙。
   * 不传时退化为逐个 `onToggle`，但父节点的勾选状态仍由子树推导。
   */
  onSetMany?: (ids: string[], checked: boolean) => void;
  depthIndent?: number;
  checkable?: boolean;
}) {
  // 默认全部展开；用户收起的节点记在本地 Set 里，切换应用/角色时组件重挂载即重置。
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  const toggleExpand = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /** 点到父节点：全选则整棵子树取消，否则整棵子树选中（子节点部分选中时补齐）。 */
  const toggleNode = (item: TreeItem<T>) => {
    const ids = flattenTreeIds([item]);
    const allChecked = ids.every((id) => selected.has(id));
    const target = !allChecked;
    if (onSetMany) {
      onSetMany(ids, target);
      return;
    }
    for (const id of ids) {
      if (selected.has(id) !== target) onToggle(id);
    }
  };

  return (
    <div className="flex flex-col">
      {items.map((item) => (
        <TreeRow
          key={item.id}
          item={item}
          selected={selected}
          onToggleNode={toggleNode}
          collapsed={collapsed}
          onToggleExpand={toggleExpand}
          depthIndent={depthIndent}
          checkable={checkable}
        />
      ))}
    </div>
  );
}

function TreeRow<T extends TreeNode>({
  item,
  selected,
  onToggleNode,
  collapsed,
  onToggleExpand,
  depthIndent,
  checkable,
}: {
  item: TreeItem<T>;
  selected: Set<string>;
  onToggleNode: (item: TreeItem<T>) => void;
  collapsed: Set<string>;
  onToggleExpand: (id: string) => void;
  depthIndent: number;
  checkable: boolean;
}) {
  const depth = item.depth ?? Math.max(0, Math.floor(item.treeCode.length / 3) - 1);
  const children = item.children ?? [];
  const open = !collapsed.has(item.id);
  // 父节点的勾选状态由整棵子树推导：全选 = 选中，部分选中 = 半选，向上自然反馈。
  const ids = flattenTreeIds([item]);
  const checkedCount = ids.reduce((count, id) => count + (selected.has(id) ? 1 : 0), 0);
  const checked = ids.length > 0 && checkedCount === ids.length;
  const indeterminate = checkedCount > 0 && checkedCount < ids.length;

  return (
    <div>
      <div
        className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-sunken"
        style={{ paddingLeft: `${12 + depth * depthIndent}px` }}
      >
        {children.length > 0 ? (
          <button
            type="button"
            onClick={() => onToggleExpand(item.id)}
            aria-label={open ? "收起子节点" : "展开子节点"}
            aria-expanded={open}
            className="shrink-0 rounded text-muted hover:text-ink"
          >
            {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
        ) : (
          <span className="w-[13px] shrink-0" />
        )}
        <FolderTree size={14} className={depth === 0 ? "text-accent" : "text-muted/70"} />
        <span className="flex-1 truncate text-[12.5px] text-ink-soft">{item.name}</span>
        <code className="font-mono text-[10px] text-muted">{item.treeCode}</code>
        {!item.enabled && <Badge tone="warn">停用</Badge>}
        {checkable && (
          <Checkbox
            checked={checked}
            indeterminate={indeterminate}
            onChange={() => onToggleNode(item)}
            label={undefined}
          />
        )}
      </div>
      {open &&
        children.length > 0 && (
          <div>
            {children.map((child) => (
              <TreeRow
                key={child.id}
                item={child}
                selected={selected}
                onToggleNode={onToggleNode}
                collapsed={collapsed}
                onToggleExpand={onToggleExpand}
                depthIndent={depthIndent}
                checkable={checkable}
              />
            ))}
          </div>
        )}
    </div>
  );
}

/* ------------------------------ grouped select ------------------------------ */

export interface GroupedOptionRows<T> {
  key: string;
  label: string;
  /** 分组树编码，用于标题后缀展示与排序（脱钩领域后全局唯一）。 */
  treeCode: string;
  rows: T[];
}

/**
 * 按 groupId 分桶。分组记录缺失（被删了或没加载）时单独放进「未分组」，
 * 绝不能静默丢弃这些条目——否则授权抽屉会凭空少掉一批权限 / 角色。
 *
 * 权限/角色分组已与领域脱钩：全局只有一棵分组树，标题不用加领域前缀，
 * 直接按 treeCode（全局唯一）排序即可。
 */
export function useGroupedOptions<T extends { groupId: string }>({
  groupApi,
  items,
}: {
  groupApi: "permGroup" | "roleGroup";
  items: T[];
}) {
  // 两个 hook 都调用以保持 hook 顺序稳定，未选中的那个 enabled=false 不会发请求。
  const permGroupQuery = usePermGroupOptions(groupApi === "permGroup");
  const roleGroupQuery = useRoleGroupOptions(groupApi === "roleGroup");
  const query = groupApi === "permGroup" ? permGroupQuery : roleGroupQuery;
  const groups = query.data ?? [];

  const grouped = useMemo<GroupedOptionRows<T>[]>(() => {
    const byId = new Map<string, AdmPermGroupVo | AdmRoleGroupVo>(groups.map((group) => [group.id, group]));
    const buckets = new Map<string, GroupedOptionRows<T>>();
    for (const item of items) {
      const group = byId.get(item.groupId);
      const key = group?.id ?? "__ungrouped__";
      const entry =
        buckets.get(key) ??
        ({
          key,
          label: group?.name ?? "未分组（分组已删除）",
          treeCode: group?.treeCode ?? "\uffff",
          rows: [],
        } satisfies GroupedOptionRows<T>);
      entry.rows.push(item);
      buckets.set(key, entry);
    }

    return [...buckets.values()].sort(
      (a, b) => a.treeCode.localeCompare(b.treeCode) || a.key.localeCompare(b.key),
    );
  }, [items, groups]);

  return { groups, grouped, loading: query.isLoading };
}

/**
 * 授权清单的分组标题：一个三态复选框 + 「已选/总数」。
 *
 * 分组树里父节点通常只是分类、本身没有数据，逐个点太慢；
 * 复选框承担「全选本组 / 清空本组」：全选勾上，部分选中显示半选。
 */
function GroupHeader({
  label,
  treeCode,
  total,
  checked,
  onToggleAll,
}: {
  label: string;
  treeCode?: string;
  total: number;
  checked: number;
  onToggleAll?: (checked: boolean) => void;
}) {
  const all = total > 0 && checked >= total;
  return (
    <div className="mb-1 flex items-center gap-2 border-b border-line/70 pb-1">
      {onToggleAll && (
        <Checkbox
          checked={all}
          indeterminate={checked > 0 && checked < total}
          onChange={onToggleAll}
          label={undefined}
        />
      )}
      <span className="truncate text-[11.5px] font-medium text-muted">{label}</span>
      {treeCode && <code className="shrink-0 font-mono text-[10px] text-muted/70">{treeCode}</code>}
      <span className="ml-auto shrink-0 text-[10.5px] text-muted/70">
        {checked}/{total}
      </span>
    </div>
  );
}

/* ------------------------------ perm check list ------------------------------ */

export function PermCheckList({
  perms,
  selected,
  onToggle,
  onSetMany,
}: {
  perms: AdmPermVo[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  /** 批量勾选本组；不传则不显示「全选本组 / 清空本组」。 */
  onSetMany?: (ids: string[], checked: boolean) => void;
}) {
  const { grouped } = useGroupedOptions({ groupApi: "permGroup", items: perms });
  if (perms.length === 0)
    return (
      <p className="rounded-lg border border-line bg-sunken px-3 py-4 text-center text-[12px] text-muted">
        还没有权限数据。请先在「权限」里创建。
      </p>
    );
  return (
    <div className="flex flex-col gap-3">
      {grouped.map(({ key, label, treeCode, rows }) => {
        const checked = rows.reduce((count, perm) => count + (selected.has(perm.id) ? 1 : 0), 0);
        const ids = rows.map((perm) => perm.id);
        return (
          <div key={key}>
            <GroupHeader
              label={label}
              treeCode={treeCode === "\uffff" ? undefined : treeCode}
              total={rows.length}
              checked={checked}
              onToggleAll={onSetMany ? (next) => onSetMany(ids, next) : undefined}
            />
            <div className="flex flex-col gap-0.5">
              {rows.map((perm) => (
                <label key={perm.id} className="flex items-start gap-2 rounded-md px-1.5 py-1 hover:bg-sunken">
                  <Checkbox
                    checked={selected.has(perm.id)}
                    onChange={() => onToggle(perm.id)}
                    label={
                      <span className="flex flex-wrap items-baseline gap-x-2 text-[12.5px] text-ink-soft">
                        {perm.name}
                        <code className="font-mono text-[11px] text-muted">{perm.urn}</code>
                        {!perm.enabled && <Badge tone="warn">停用</Badge>}
                      </span>
                    }
                  />
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------ menu tree from backend ------------------------------ */

/**
 * 菜单授权清单按应用切段：与侧栏一致，只有多应用时才显示应用标题；
 * 每段单独建树并用 `appId` 隔离，避免跨应用同 treeCode 串挂。
 */
export function MenuCheckList({
  menus,
  selected,
  onToggle,
  onSetMany,
}: {
  menus: AdmMenuVo[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  /** 批量勾选本应用（含所有子孙菜单）；不传则不显示批量按钮。 */
  onSetMany?: (ids: string[], checked: boolean) => void;
}) {
  const appsQuery = useAppOptions();
  const apps = appsQuery.data ?? [];

  const groups = useMemo(() => {
    const byId = new Map(apps.map((app) => [app.id, app.name]));
    const order = new Map(apps.map((app, index) => [app.id, index]));
    const buckets = new Map<string, AdmMenuVo[]>();
    for (const menu of menus) {
      const rows = buckets.get(menu.appId) ?? [];
      rows.push(menu);
      buckets.set(menu.appId, rows);
    }
    return [...buckets.entries()]
      .sort(
        (a, b) =>
          (order.get(a[0]) ?? Number.MAX_SAFE_INTEGER) - (order.get(b[0]) ?? Number.MAX_SAFE_INTEGER) ||
          a[0].localeCompare(b[0]),
      )
      .map(([appId, rows]) => ({
        appId,
        label: byId.get(appId) ?? `应用 ${shortId(appId)}`,
        tree: buildTree(rows, (row) => row.appId),
      }));
  }, [menus, apps]);

  if (menus.length === 0)
    return (
      <p className="rounded-lg border border-line bg-sunken px-3 py-4 text-center text-[12px] text-muted">
        还没有菜单数据。请先在「菜单」里创建。
      </p>
    );

  return (
    <div className="flex max-h-[420px] flex-col gap-3 overflow-y-auto rounded-lg border border-line p-1.5">
      {groups.map((group) => {
        // 勾选要连子孙一起算：只勾根节点会让子菜单漏授权。
        const ids = flattenTreeIds(group.tree);
        const checked = ids.reduce((count, id) => count + (selected.has(id) ? 1 : 0), 0);
        return (
          <div key={group.appId}>
            <GroupHeader
              label={group.label}
              total={ids.length}
              checked={checked}
              onToggleAll={onSetMany ? (next) => onSetMany(ids, next) : undefined}
            />
            <TreeCheckboxGroup
              items={group.tree}
              selected={selected}
              onToggle={onToggle}
              onSetMany={onSetMany}
            />
          </div>
        );
      })}
    </div>
  );
}
