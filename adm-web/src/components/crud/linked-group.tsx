/**
 * 「左侧分组树 ↔ 右侧分组/条目」双栏勾选组件。
 *
 * 角色授权（权限分组→权限）、用户分配角色（角色分组→角色）共用这一套语义：
 * - 左右两侧勾选的是同一份 `selectedIds`，因此天然双向联动；
 * - 分组行的复选框覆盖「本组 + 全部子孙组」的条目，父组全选/半选由子树推导；
 * - 左侧点分组名只切换右侧展示范围，不改变勾选；
 * - 右侧展示选中分组以下完整的树形分组；若其下再无子分组，则不画分组标题，
 *   直接平铺条目（旧实现固定按最后两级分组，选到任意一级都看不到真实层级）。
 *
 * 两栏都是 `flex min-h-0 flex-1 overflow-y-auto`，由抽屉的弹性布局把高度撑满。
 */
import { useMemo, useState, type ReactNode } from "react";
import { Checkbox, Spinner } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, Layers3, ListChecks } from "lucide-react";
import { buildTree } from "./tree-utils";
import type { TreeItem, TreeNode } from "./tree-utils";

const UNGROUPED = "__ungrouped__";

interface SelectableItem {
  id: string;
  groupId?: string;
}

export interface LinkedGroupSelectorProps<T extends SelectableItem> {
  groups: TreeNode[];
  items: T[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onSetMany: (ids: string[], checked: boolean) => void;
  /** 只渲染条目标题行，勾选框和状态由本组件统一画。 */
  renderItem: (item: T) => ReactNode;
  leftTitle: string;
  rightTitle: string;
  leftHint?: string;
  rightHint?: string;
  emptyText?: string;
  loading?: boolean;
  ungroupedLabel?: string;
}

function collectTreeIds(nodes: TreeItem<TreeNode>[]): Map<string, string[]> {
  const result = new Map<string, string[]>();
  const walk = (node: TreeItem<TreeNode>): string[] => {
    const ids = [node.id, ...(node.children ?? []).flatMap(walk)];
    result.set(node.id, ids);
    return ids;
  };
  for (const node of nodes) walk(node);
  return result;
}

function checkState(ids: string[], selected: Set<string>) {
  const count = ids.reduce((sum, id) => sum + (selected.has(id) ? 1 : 0), 0);
  return {
    checked: ids.length > 0 && count === ids.length,
    indeterminate: count > 0 && count < ids.length,
    count,
  };
}

export function LinkedGroupSelector<T extends SelectableItem>({
  groups,
  items,
  selectedIds,
  onToggle,
  onSetMany,
  renderItem,
  leftTitle,
  rightTitle,
  leftHint,
  rightHint,
  emptyText = "还没有分组数据。",
  loading = false,
  ungroupedLabel = "未分组（分组已删除）",
}: LinkedGroupSelectorProps<T>) {
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  const tree = useMemo(() => buildTree(groups), [groups]);
  const treeIds = useMemo(() => collectTreeIds(tree), [tree]);

  const itemsByGroup = useMemo(() => {
    const map = new Map<string, T[]>();
    for (const item of items) {
      const key = item.groupId ?? UNGROUPED;
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return map;
  }, [items]);

  /** 分组 → 本组及子孙分组下的全部条目 id。左侧与右侧的复选框共用。 */
  const itemIdsOfGroup = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const [groupId, groupIds] of treeIds) {
      map.set(
        groupId,
        groupIds.flatMap((id) => (itemsByGroup.get(id) ?? []).map((item) => item.id)),
      );
    }
    return map;
  }, [treeIds, itemsByGroup]);

  // null = 全部：右栏展示整棵分组树。选中具体分组时只展示它（含子孙）以下的层级。
  const allState = useMemo(
    () => checkState(items.map((item) => item.id), selectedIds),
    [items, selectedIds],
  );

  const activeGroupId = selectedGroup && groups.some((group) => group.id === selectedGroup)
    ? selectedGroup
    : null;
  const activeGroup = groups.find((group) => group.id === activeGroupId);
  const descendants = useMemo(
    () => (activeGroup ? groups.filter((group) => group.treeCode.startsWith(activeGroup.treeCode)) : groups),
    [groups, activeGroup],
  );
  const rightTree = useMemo(() => buildTree(descendants), [descendants]);
  const ungrouped = itemsByGroup.get(UNGROUPED) ?? [];

  const toggleExpand = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const groupRow = (
    node: TreeItem<TreeNode>,
    depth: number,
    navigable: boolean,
    itemRowsFor?: (groupId: string) => ReactNode,
  ) => {
    const ids = itemIdsOfGroup.get(node.id) ?? [];
    const state = checkState(ids, selectedIds);
    const open = !collapsed.has(node.id);
    const children = node.children ?? [];
    return (
      <div key={node.id}>
        <div
          className={cn(
            "flex min-w-0 items-center gap-1.5 rounded-md py-1 pr-1.5 hover:bg-sunken",
            navigable && activeGroupId === node.id && "bg-accent-soft",
          )}
          style={{ paddingLeft: `${6 + depth * 16}px` }}
        >
          {children.length > 0 ? (
            <button
              type="button"
              onClick={() => toggleExpand(node.id)}
              aria-label={open ? "收起子分组" : "展开子分组"}
              aria-expanded={open}
              className="shrink-0 rounded p-0.5 text-muted hover:text-ink"
            >
              {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </button>
          ) : (
            <span className="w-[17px] shrink-0" />
          )}
          <Checkbox
            checked={state.checked}
            indeterminate={state.indeterminate}
            onChange={(next) => onSetMany(ids, next)}
            label={undefined}
            disabled={ids.length === 0}
          />
          {navigable ? (
            <button
              type="button"
              onClick={() => setSelectedGroup(node.id)}
              aria-pressed={activeGroupId === node.id}
              className={cn(
                "flex min-w-0 flex-1 items-center gap-1.5 text-left text-[12.5px]",
                activeGroupId === node.id
                  ? "font-medium text-accent-strong"
                  : "text-ink-soft hover:text-ink",
              )}
            >
              <span className="truncate">{node.name}</span>
              <code className="shrink-0 font-mono text-[10px] text-muted">{node.treeCode}</code>
              {!node.enabled && <span className="shrink-0 text-[10px] text-warn">停用</span>}
            </button>
          ) : (
            <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[12px] text-ink">
              <span className="truncate">{node.name}</span>
              <code className="shrink-0 font-mono text-[10px] text-muted/70">{node.treeCode}</code>
              <span className="ml-auto shrink-0 text-[10.5px] text-muted/70">
                {state.count}/{ids.length}
              </span>
            </span>
          )}
        </div>
        {!navigable && itemRowsFor && <div className="ml-6 mt-0.5">{itemRowsFor(node.id)}</div>}
        {open && children.map((child) => groupRow(child, depth + 1, navigable, itemRowsFor))}
      </div>
    );
  };

  const itemRows = (rows: T[]) => (
    <div className="flex flex-col gap-0.5">
      {rows.map((item) => (
        <label key={item.id} className="flex items-start gap-2 rounded-md px-1.5 py-1 hover:bg-sunken">
          <Checkbox
            checked={selectedIds.has(item.id)}
            onChange={() => onToggle(item.id)}
            label={undefined}
          />
          <span className="min-w-0 flex-1 text-[12.5px] text-ink-soft">{renderItem(item)}</span>
        </label>
      ))}
    </div>
  );

  /** 右侧：选中分组下还有子分组 → 画完整分组树；否则不画分组标题，直接列条目。 */
  const hasSubGroups = descendants.length > 1;
  const rightContent = () => {
    if (descendants.length === 0 && ungrouped.length === 0) {
      return (
        <p className="rounded-lg border border-dashed border-line px-3 py-8 text-center text-[12px] text-muted">
          {emptyText}
        </p>
      );
    }
    return (
      <div className="flex flex-col gap-2">
        {hasSubGroups
          ? rightTree.map((node) =>
              groupRow(node, 0, false, (groupId) => itemRows(itemsByGroup.get(groupId) ?? [])),
            )
          : itemRows(
              activeGroup
                ? (itemsByGroup.get(activeGroup.id) ?? [])
                : descendants.flatMap((group) => itemsByGroup.get(group.id) ?? []),
            )}
        {ungrouped.length > 0 && (
          <div className="mt-1 border-t border-line pt-2">
            <div className="mb-1 text-[11.5px] font-medium text-muted">{ungroupedLabel}</div>
            {itemRows(ungrouped)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
      <aside className="flex w-full flex-col overflow-hidden rounded-xl border border-line bg-surface lg:w-[248px] lg:shrink-0">
        <div className="flex shrink-0 items-center gap-1.5 border-b border-line px-3 py-2 text-[12.5px] font-semibold text-ink">
          <Layers3 size={13} className="text-muted" /> {leftTitle}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {loading ? (
            <Spinner label="分组加载中…" />
          ) : tree.length === 0 && items.length === 0 ? (
            <p className="px-2 py-4 text-[11.5px] leading-relaxed text-muted">{emptyText}</p>
          ) : (
            <div className="flex flex-col gap-0.5">
              <div
                className={cn(
                  "flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-1.5",
                  !activeGroupId && "bg-accent-soft",
                )}
              >
                <Checkbox
                  checked={allState.checked}
                  indeterminate={allState.indeterminate}
                  onChange={(next) => onSetMany(items.map((item) => item.id), next)}
                  label={undefined}
                  disabled={items.length === 0}
                />
                <button
                  type="button"
                  onClick={() => setSelectedGroup(null)}
                  aria-pressed={!activeGroupId}
                  className={cn(
                    "flex min-w-0 flex-1 text-left text-[12.5px]",
                    !activeGroupId ? "font-medium text-accent-strong" : "text-ink-soft hover:text-ink",
                  )}
                >
                  全部
                  <span className="ml-auto text-[10.5px] font-normal text-muted/70">
                    {allState.count}/{items.length}
                  </span>
                </button>
              </div>
              {tree.map((node) => groupRow(node, 0, true))}
            </div>
          )}
        </div>
        {leftHint && (
          <div className="shrink-0 border-t border-line px-3 py-2 text-[11px] leading-relaxed text-muted">
            {leftHint}
          </div>
        )}
      </aside>
      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-line bg-surface">
        <div className="flex shrink-0 items-center gap-1.5 border-b border-line px-3 py-2 text-[12.5px] font-semibold text-ink">
          <ListChecks size={13} className="text-muted" /> {rightTitle}
          <span className="ml-auto text-[11px] font-normal text-muted">
            {activeGroup?.name ?? "全部分组"}
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">{rightContent()}</div>
        {rightHint && (
          <div className="shrink-0 border-t border-line px-3 py-2 text-[11px] leading-relaxed text-muted">
            {rightHint}
          </div>
        )}
      </section>
    </div>
  );
}
