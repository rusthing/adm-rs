import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, ChevronRight, Search, X } from "lucide-react";
import { overlayPortalTarget } from "@/components/ui/overlay";
import { cn } from "@/lib/utils";

/** 左侧树的节点：组织树、角色分组树共用 `treeCode` 表达层级。 */
export interface PickerTreeNode {
  id: string;
  label: string;
  treeCode?: string;
  disabled?: boolean;
}

/** 右侧表格的一列。 */
export interface PickerColumn<T> {
  key: string;
  label: string;
  className?: string;
  render: (row: T) => ReactNode;
}

/** 领域 tab：与用户管理页顶部同一套数据域切换。 */
export interface PickerRealm {
  id: string;
  label: string;
}

export interface ManagedPickerProps<T> {
  value: string;
  onChange: (value: string) => void;
  items: T[];
  rowId: (row: T) => string;
  /** 触发器上显示的文案。 */
  rowLabel: (row: T) => string;
  /** 搜索时匹配的文本（名称、工号、ID 等）。 */
  rowSearchText: (row: T) => string;
  columns: PickerColumn<T>[];
  /** 左树；不传时只显示右侧表格。 */
  tree?: PickerTreeNode[];
  treeTitle?: string;
  treeEmptyText?: string;
  /** 行归属的分组 id 集合，用于选中树节点后收窄；不传表示不按树筛选。 */
  rowGroups?: (row: T) => string[];
  /** 领域列表：多于一个时在面板顶部显示 tab，与用户管理页一致。 */
  realms?: PickerRealm[];
  /** 行所属领域 id 集合；配合 `realms` 收窄右侧表格。 */
  rowRealms?: (row: T) => string[];
  /** 左树节点所属领域 id 集合；配合 `realms` 收窄左侧组织树。 */
  treeNodeRealms?: (node: PickerTreeNode) => string[];
  title?: string;
  placeholder?: string;
  loading?: boolean;
  disabled?: boolean;
  allowClear?: boolean;
  className?: string;
  pageSize?: number;
  emptyText?: string;
}

const PANEL_WIDTH = 640;
const PANEL_HEIGHT = 430;
const PAGE_SIZE = 8;

/** treeCode 每层 3 位，根为 0。 */
function depthOf(treeCode?: string): number {
  return treeCode ? Math.max(0, Math.floor(treeCode.length / 3) - 1) : 0;
}

/** 选中节点 + 全部子孙的 id；treeCode 非法时退回只含自身。 */
function subtreeGroupIds(nodes: PickerTreeNode[], rootId: string): string[] {
  const root = nodes.find((node) => node.id === rootId);
  if (!root?.treeCode) return [rootId];
  const prefix = root.treeCode;
  return nodes
    .filter((node) => {
      const code = node.treeCode ?? "";
      const extra = code.length - prefix.length;
      return extra >= 0 && extra % 3 === 0 && code.startsWith(prefix);
    })
    .map((node) => node.id);
}

/**
 * 用户管理式选择面板。
 *
 * 形态与 adm 用户管理页一致：左侧组织/分组树，右侧带搜索、表头与分页的表格，
 * 整行点选。面板通过 portal 锚定在字段下方，不新开独立窗口。
 */
export function ManagedPicker<T>({
  value,
  onChange,
  items,
  rowId,
  rowLabel,
  rowSearchText,
  columns,
  tree,
  treeTitle = "组织",
  treeEmptyText = "暂无可选分组",
  rowGroups,
  realms,
  rowRealms,
  treeNodeRealms,
  title = "请选择",
  placeholder = "请选择",
  loading = false,
  disabled = false,
  allowClear = true,
  className,
  pageSize = PAGE_SIZE,
  emptyText = "没有匹配的选项",
}: ManagedPickerProps<T>) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [treeQuery, setTreeQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [treeSelected, setTreeSelected] = useState<string | null>(null);
  const [activeRealm, setActiveRealm] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [rect, setRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  const selected = useMemo(() => items.find((item) => rowId(item) === value), [items, rowId, value]);

  /** 领域 tab 收窄后的左树；未选领域时保持全量。 */
  const realmTree = useMemo(() => {
    if (!activeRealm || !treeNodeRealms) return tree;
    return (tree ?? []).filter((node) => treeNodeRealms(node).includes(activeRealm));
  }, [activeRealm, tree, treeNodeRealms]);

  /** 当前树节点（含子孙）对应的分组 id；未选节点为 null。 */
  const allowedGroups = useMemo(() => {
    if (!realmTree || !treeSelected) return null;
    return new Set(subtreeGroupIds(realmTree, treeSelected));
  }, [realmTree, treeSelected]);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return items.filter((item) => {
      if (activeRealm && rowRealms && !rowRealms(item).includes(activeRealm)) return false;
      if (allowedGroups && rowGroups) {
        const groups = rowGroups(item);
        if (!groups.some((id) => allowedGroups.has(id))) return false;
      }
      if (!keyword) return true;
      return rowSearchText(item).toLowerCase().includes(keyword);
    });
  }, [activeRealm, allowedGroups, items, query, rowGroups, rowRealms, rowSearchText]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = useMemo(
    () => filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filtered, currentPage, pageSize],
  );

  /** 面板摆放：下方空间不足时翻到上方，宽度按视口收敛。 */
  const place = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const box = trigger.getBoundingClientRect();
    const width = Math.min(Math.max(box.width, PANEL_WIDTH), window.innerWidth - 16);
    const below = window.innerHeight - box.bottom - 12;
    const above = box.top - 12;
    const flip = below < 300 && above > below;
    const height = Math.min(PANEL_HEIGHT, Math.max(260, flip ? above : below));
    setRect({
      left: Math.min(Math.max(8, box.left), window.innerWidth - width - 8),
      top: flip ? Math.max(8, box.top - height - 6) : box.bottom + 6,
      width,
      height,
    });
  };

  const openPanel = () => {
    if (disabled) return;
    place();
    setQuery("");
    setTreeQuery("");
    setPage(1);
    setOpen(true);
  };

  const closePanel = (focusTrigger = false) => {
    setOpen(false);
    if (focusTrigger) triggerRef.current?.focus();
  };

  const choose = (row: T) => {
    onChange(rowId(row));
    closePanel(true);
  };

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      closePanel();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        closePanel(true);
      }
    };
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
    // place 只依赖 ref 与视口尺寸
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 搜索或切换树节点后回到第一页，避免停在越界页码上。
  useEffect(() => {
    setPage(1);
  }, [query, treeSelected]);

  /** 树节点是否被折叠：只看祖先编码。 */
  const parentCodes = useMemo(() => {
    const codes = new Set<string>();
    for (const node of realmTree ?? []) {
      const code = node.treeCode;
      if (!code) continue;
      for (let length = code.length - 3; length >= 3; length -= 3) codes.add(code.slice(0, length));
    }
    return codes;
  }, [realmTree]);

  const treeVisible = useMemo(() => {
    const nodes = realmTree ?? [];
    const keyword = treeQuery.trim().toLowerCase();
    if (!keyword) return nodes;
    // 搜索时保留命中节点及其全部祖先，并忽略折叠状态。
    const keep = new Set<string>();
    for (const node of nodes) {
      if (!node.label.toLowerCase().includes(keyword)) continue;
      keep.add(node.id);
      const code = node.treeCode;
      if (!code) continue;
      for (let length = code.length - 3; length >= 3; length -= 3) {
        const prefix = code.slice(0, length);
        const parent = nodes.find((candidate) => candidate.treeCode === prefix);
        if (parent) keep.add(parent.id);
      }
    }
    return nodes.filter((node) => keep.has(node.id));
  }, [realmTree, treeQuery]);

  const isHidden = (node: PickerTreeNode) => {
    const code = node.treeCode;
    if (!code || treeQuery.trim()) return false;
    for (let length = code.length - 3; length >= 3; length -= 3) {
      if (collapsed.has(code.slice(0, length))) return true;
    }
    return false;
  };

  const toggleNode = (code: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });

  const displayText = selected
    ? rowLabel(selected)
    : value
      ? `#${value}（未在列表中）`
      : placeholder;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="dialog"
        disabled={disabled || loading}
        onClick={() => (open ? closePanel() : openPanel())}
        className={cn(
          "flex h-9 w-full items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-left text-[13px] text-ink transition-colors hover:border-line-strong focus:border-accent focus:outline-none disabled:cursor-not-allowed disabled:bg-sunken disabled:text-muted",
          className,
        )}
      >
        <span className={cn("min-w-0 flex-1 truncate", !selected && "text-muted/80")}>
          {loading ? "加载中…" : displayText}
        </span>
        {value && allowClear && !disabled && !loading ? (
          <span
            role="button"
            tabIndex={-1}
            aria-label="清除"
            className="grid size-4 shrink-0 place-items-center rounded text-muted hover:bg-sunken hover:text-ink"
            onClick={(event) => {
              event.stopPropagation();
              onChange("");
            }}
          >
            <X className="size-3" />
          </span>
        ) : null}
        <ChevronDown className={cn("size-3.5 shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </button>

      {open && rect
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              aria-label={title}
              className="fixed z-[90] flex flex-col overflow-hidden rounded-[12px] border border-line bg-surface shadow-panel"
              style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
            >
              <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
                <span className="text-[12.5px] font-semibold text-ink">{title}</span>
                <span className="text-[11px] text-muted">
                  {loading ? "加载中…" : `${filtered.length} / ${items.length}`}
                </span>
              </div>

              {realms && realms.length > 1 ? (
                <div className="flex items-center gap-1 overflow-x-auto border-b border-line px-2 py-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveRealm(null);
                      setTreeSelected(null);
                    }}
                    className={cn(
                      "shrink-0 rounded-md px-2 py-0.5 text-[11.5px] transition-colors",
                      activeRealm === null
                        ? "bg-accent-soft font-medium text-accent-strong"
                        : "text-ink-soft hover:bg-sunken hover:text-ink",
                    )}
                  >
                    全部领域
                  </button>
                  {realms.map((realm) => (
                    <button
                      key={realm.id}
                      type="button"
                      onClick={() => {
                        setActiveRealm(realm.id);
                        setTreeSelected(null);
                      }}
                      className={cn(
                        "shrink-0 rounded-md px-2 py-0.5 text-[11.5px] transition-colors",
                        activeRealm === realm.id
                          ? "bg-accent-soft font-medium text-accent-strong"
                          : "text-ink-soft hover:bg-sunken hover:text-ink",
                      )}
                    >
                      {realm.label}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="flex min-h-0 flex-1">
                {tree ? (
                  <aside className="flex w-[188px] shrink-0 flex-col border-r border-line">
                    <div className="flex items-center gap-1.5 border-b border-line px-2 py-1.5">
                      <Search className="size-3 shrink-0 text-muted" />
                      <input
                        value={treeQuery}
                        onChange={(event) => setTreeQuery(event.target.value)}
                        placeholder={`搜索${treeTitle}`}
                        className="h-6 min-w-0 flex-1 bg-transparent text-[11.5px] text-ink outline-none placeholder:text-muted/80"
                      />
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto p-1">
                      <button
                        type="button"
                        onClick={() => setTreeSelected(null)}
                        aria-pressed={!treeSelected}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] font-medium transition-colors",
                          !treeSelected ? "bg-accent-soft text-accent-strong" : "text-ink-soft hover:bg-sunken hover:text-ink",
                        )}
                      >
                        全部
                        <span className="ml-auto text-[10.5px] font-normal text-muted">不限</span>
                      </button>
                      {(realmTree ?? []).length === 0 ? (
                        <p className="px-2 py-3 text-[11px] leading-relaxed text-muted">{treeEmptyText}</p>
                      ) : (
                        <div className="mt-0.5 flex flex-col gap-0.5">
                          {treeVisible.map((node) => {
                            if (isHidden(node)) return null;
                            const code = node.treeCode;
                            const isParent = code ? parentCodes.has(code) : false;
                            const expanded = !(code && collapsed.has(code));
                            const active = treeSelected === node.id;
                            return (
                              <div
                                key={node.id}
                                className="flex items-center gap-0.5"
                                style={{ paddingLeft: `${2 + depthOf(node.treeCode) * 12}px` }}
                              >
                                {isParent ? (
                                  <button
                                    type="button"
                                    onClick={() => toggleNode(code!)}
                                    aria-label={expanded ? "收起子分组" : "展开子分组"}
                                    aria-expanded={expanded}
                                    className="shrink-0 rounded p-0.5 text-muted hover:text-ink"
                                  >
                                    {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                                  </button>
                                ) : (
                                  <span className="w-[15px] shrink-0" />
                                )}
                                <button
                                  type="button"
                                  onClick={() => setTreeSelected(node.id)}
                                  aria-pressed={active}
                                  title={node.label}
                                  className={cn(
                                    "flex min-w-0 flex-1 items-center gap-1 rounded-md px-1.5 py-1 text-left text-[12px] transition-colors",
                                    active
                                      ? "bg-accent-soft font-medium text-accent-strong"
                                      : "text-ink-soft hover:bg-sunken hover:text-ink",
                                    node.disabled && "opacity-60",
                                  )}
                                >
                                  <span className="min-w-0 flex-1 truncate">{node.label}</span>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </aside>
                ) : null}

                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-center gap-2 border-b border-line px-2.5 py-1.5">
                    <Search className="size-3.5 shrink-0 text-muted" />
                    <input
                      ref={searchRef}
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="搜索名称、工号或 ID"
                      className="h-6 min-w-0 flex-1 bg-transparent text-[12px] text-ink outline-none placeholder:text-muted/80"
                    />
                  </div>

                  <div className="min-h-0 flex-1 overflow-auto">
                    <table className="w-full table-fixed border-collapse text-left">
                      <thead className="sticky top-0 z-10 bg-sunken/95 text-[10.5px] font-medium text-muted">
                        <tr>
                          {columns.map((column) => (
                            <th key={column.key} className={cn("px-2.5 py-1.5 font-medium", column.className)}>
                              {column.label}
                            </th>
                          ))}
                          <th className="w-8" />
                        </tr>
                      </thead>
                      <tbody>
                        {pageRows.map((row) => {
                          const id = rowId(row);
                          const active = id === value;
                          return (
                            <tr
                              key={id}
                              onClick={() => choose(row)}
                              className={cn(
                                "cursor-pointer border-t border-line/60 text-[12px] transition-colors",
                                active ? "bg-accent-soft/60" : "hover:bg-sunken/70",
                              )}
                            >
                              {columns.map((column) => (
                                <td key={column.key} className={cn("truncate px-2.5 py-1.5 align-middle", column.className)}>
                                  {column.render(row)}
                                </td>
                              ))}
                              <td className="px-1 py-1.5 text-center">
                                {active ? <Check className="mx-auto size-3.5 text-accent" /> : null}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {pageRows.length === 0 ? (
                      <p className="px-3 py-8 text-center text-[12px] text-muted">
                        {loading ? "加载中…" : emptyText}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t border-line px-2.5 py-1.5 text-[11px] text-muted">
                    <span>
                      共 {filtered.length} 条 · 第 {currentPage} / {pageCount} 页
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setPage((current) => Math.max(1, current - 1))}
                        disabled={currentPage <= 1}
                        className="rounded border border-line px-1.5 py-0.5 text-[11px] text-ink-soft transition-colors hover:bg-sunken disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        上一页
                      </button>
                      <button
                        type="button"
                        onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                        disabled={currentPage >= pageCount}
                        className="rounded border border-line px-1.5 py-0.5 text-[11px] text-ink-soft transition-colors hover:bg-sunken disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        下一页
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            overlayPortalTarget(),
          )
        : null}
    </>
  );
}
