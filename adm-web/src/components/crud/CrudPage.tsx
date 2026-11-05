import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, GripVertical, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import { crudApi } from "@/lib/api";
import type { CrudApi } from "@/lib/api";
import type { FormValues, PageQuery, TreeDeletePreview } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  Button,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Pagination,
  Select,
  Spinner,
  Switch,
  Textarea,
} from "@/components/ui/primitives";
import { Modal, useConfirm, useToast } from "@/components/ui/overlay";
import { CellValue } from "./cells";
import type { BooleanCellLabels, CrudCellType } from "./cells";
import {
  buildFilterParams,
  hasActiveFilterValues,
  keywordParamName,
  keywordPlaceholder,
} from "./filters";
import type { CrudDateRange, CrudFilterDef, CrudFilterValue, CrudFilterValues } from "./filters";
import {
  applySortPreview,
  buildSortOrderMap,
  buildSortSequence,
  moveSortIdTo,
  sortGroupKey,
  swapSortId,
} from "./sort";
import type { CrudSortable } from "./sort";
import {
  applyFieldChange,
  defaultsOf,
  fieldKey,
  resolveFieldOptions,
  validateForm,
  visibleFieldsOf,
} from "./fields";
import type { CrudField, FormMode } from "./fields";

export type { CrudCellType } from "./cells";
export type { CrudFilterDef, CrudFilterType, CrudFilterOption } from "./filters";
export type { CrudSortable } from "./sort";
export type { CrudField, CrudFieldOption, FormMode } from "./fields";

export interface CrudColumn<T> {
  key: string;
  label: string;
  /** 不写时走统一单元格渲染；需要自定义徽标/组合展示时再使用 render。 */
  render?: (row: T) => ReactNode;
  /** 统一格式化类型，默认 text。日期毫秒、布尔、长 ID 一律声明类型，不要每页手写 formatMs。 */
  type?: CrudCellType;
  /** `type: "boolean"` 时的文案，默认「是 / 否」。 */
  booleanLabels?: BooleanCellLabels;
  className?: string;
  align?: "left" | "right";
  /**
   * 超长文案（备注、路径等）设为 true：单元格内单行省略并带 title 悬浮全文，
   * 避免撑宽表格导致横向滚动失控。
   */
  truncate?: boolean;
}

interface CrudPageProps<T extends { id: string }> {
  title: string;
  subtitle?: ReactNode;
  prefix: string;
  columns: CrudColumn<T>[];
  fields: CrudField[];
  itemLabel: (row: T) => string;
  defaultOrderBy?: string;
  searchPlaceholder?: string;
  createLabel?: string;
  toolbarExtra?: ReactNode;
  extraQuery?: PageQuery;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  toForm: (row: T) => FormValues;
  toPayload: (values: FormValues, mode: FormMode, row?: T) => Record<string, unknown>;
  rowActions?: (row: T, helpers: { reload: () => void }) => ReactNode;
  emptyDescription?: string;
  /**
   * 搜索行的筛选 schema。声明后控件会与关键字搜索框排在同一行，并共享「重置」按钮。
   * 类型与拼接规则见 `./filters.ts`；页面只声明 schema，不写查询参数拼装。
   */
  filters?: CrudFilterDef[];
  /**
   * 排序模式。声明后列表出现「排序」列：组内序号 + 上移/下移 + 拖拽。
   * 排序值由服务端维护，前端只提交同组完整 id 顺序。
   * 日志类实体不要声明。
   */
  sortable?: CrudSortable<T>;
}

/**
 * 单个筛选控件的渲染。
 *
 * 扩展点：先在 `./filters.ts` 的 `CrudFilterDef` 增加类型，再在这里补一个控件分支。
 * 关联实体（entity）静态选项与异步 `loadOptions` 都支持，异步结果按页面 prefix 缓存。
 */
function FilterControl({
  def,
  value,
  prefix,
  onChange,
}: {
  def: CrudFilterDef;
  value: CrudFilterValue;
  prefix: string;
  onChange: (value: CrudFilterValue) => void;
}) {
  if (def.type === "date-range") {
    const range = typeof value === "object" && value !== null ? value : {};
    return (
      <div className="flex items-center gap-1.5 text-[11.5px] text-muted">
        <span className="whitespace-nowrap">{def.label}</span>
        <Input
          type="date"
          aria-label={`${def.label}开始`}
          value={range.start ?? ""}
          max={range.end || undefined}
          onChange={(event) => onChange({ ...range, start: event.target.value })}
          className="h-8 w-[132px] text-[12px]"
        />
        <span>~</span>
        <Input
          type="date"
          aria-label={`${def.label}结束`}
          value={range.end ?? ""}
          min={range.start || undefined}
          onChange={(event) => onChange({ ...range, end: event.target.value })}
          className="h-8 w-[132px] text-[12px]"
        />
      </div>
    );
  }

  if (def.type === "boolean") {
    return (
      <label className="flex items-center gap-1.5 text-[11.5px] text-muted">
        <span className="whitespace-nowrap">{def.label}</span>
        <Select
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
          className="h-8 w-auto min-w-[76px] text-[12.5px]"
        >
          <option value="">全部</option>
          <option value="true">是</option>
          <option value="false">否</option>
        </Select>
      </label>
    );
  }

  if (def.type === "entity") {
    return (
      <EntityFilterControl def={def} value={value} prefix={prefix} onChange={onChange} />
    );
  }

  if (def.type === "keyword") return null;

  // def.type === "select"
  return (
    <label className="flex items-center gap-1.5 text-[11.5px] text-muted">
      <span className="whitespace-nowrap">{def.label}</span>
      <Select
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 w-auto min-w-[92px] text-[12.5px]"
      >
        <option value="">全部</option>
        {def.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </label>
  );
}

/** 关联实体筛选：静态 options 优先，否则用 loadOptions 异步加载。 */
function EntityFilterControl({
  def,
  value,
  prefix,
  onChange,
}: {
  def: Extract<CrudFilterDef, { type: "entity" }>;
  value: CrudFilterValue;
  prefix: string;
  onChange: (value: CrudFilterValue) => void;
}) {
  const needsLoad = def.options === undefined && Boolean(def.loadOptions);
  const optionsQuery = useQuery({
    queryKey: ["crud-filter-options", prefix, def.name],
    queryFn: () => (def.loadOptions ? def.loadOptions() : Promise.resolve([])),
    enabled: needsLoad,
    staleTime: 60_000,
  });
  const options = def.options ?? optionsQuery.data ?? [];

  return (
    <label className="flex items-center gap-1.5 text-[11.5px] text-muted">
      <span className="whitespace-nowrap">{def.label}</span>
      <Select
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value)}
        disabled={optionsQuery.isLoading}
        className="h-8 w-auto min-w-[120px] text-[12.5px]"
      >
        <option value="">{optionsQuery.isLoading ? "加载中…" : "全部"}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </label>
  );
}

export function CrudPage<T extends { id: string }>({
  title,
  subtitle,
  prefix,
  columns,
  fields,
  itemLabel,
  defaultOrderBy,
  searchPlaceholder = "按关键字搜索（后端按可检索字段模糊匹配）",
  createLabel = "新建",
  toolbarExtra,
  extraQuery,
  canCreate = true,
  canEdit = true,
  canDelete = true,
  toForm,
  toPayload,
  rowActions,
  emptyDescription,
  filters,
  sortable,
}: CrudPageProps<T>) {
  const api = useMemo<CrudApi<T>>(() => crudApi<T>(prefix), [prefix]);
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const formId = useId();
  /** 关键字防抖定时器：Enter / Esc / 清空时立即取消，避免旧 timer 覆盖即时结果。 */
  const keywordTimerRef = useRef<number | null>(null);

  const [page, setPage] = useState(1);
  const [size, setSize] = useState(20);
  const [keyword, setKeyword] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [reloadTick, setReloadTick] = useState(0);

  const [filterValues, setFilterValues] = useState<CrudFilterValues>({});

  const [editing, setEditing] = useState<{ mode: FormMode; row?: T; values: FormValues } | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  /** 树形实体的删除确认：先查服务端预检，再让用户确认级联范围 */
  const [deleteTarget, setDeleteTarget] = useState<{
    row: T;
    preview?: TreeDeletePreview;
    loading: boolean;
    error?: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  /** 详情/删除预检是异步请求，用递增令牌丢弃“后发先至”的旧响应。 */
  const detailRequestRef = useRef(0);
  const previewRequestRef = useRef(0);
  /** 排序提交串行化，避免连续点击上移/下移时两个 reorder 并发覆盖。 */
  const sortBusyRef = useRef(false);

  const keywordName = keywordParamName(filters);
  const filterParams = useMemo(() => buildFilterParams(filters, filterValues), [filters, filterValues]);
  const filterKey = JSON.stringify(filterParams);
  const extraKey = JSON.stringify(extraQuery ?? {});

  const cancelKeywordTimer = () => {
    if (keywordTimerRef.current !== null) {
      window.clearTimeout(keywordTimerRef.current);
      keywordTimerRef.current = null;
    }
  };

  useEffect(() => {
    cancelKeywordTimer();
    keywordTimerRef.current = window.setTimeout(() => {
      keywordTimerRef.current = null;
      setAppliedKeyword(keyword.trim());
      setPage(1);
    }, 350);
    return cancelKeywordTimer;
    // cancelKeywordTimer 只操作 ref，不随渲染变化
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword]);

  const buildQuery = (): PageQuery => ({
    _page: page,
    _size: size,
    [keywordName]: appliedKeyword || undefined,
    _orderBy: defaultOrderBy,
    ...(extraQuery ?? {}),
    ...filterParams,
  });

  const query = useQuery({
    queryKey: [prefix, "page", page, size, appliedKeyword, defaultOrderBy, extraKey, filterKey, reloadTick],
    // search/page 是后端已暴露的检索接口，支持 `字段-op` 运算符（日期范围等）。
    queryFn: () => api.searchPage(buildQuery()),
    staleTime: 5_000,
  });

  const rows = query.data?.list ?? [];
  const total = Number(query.data?.total ?? 0);
  const pageCount = Math.max(1, Math.ceil(total / size));
  const hasActiveFilters = Boolean(appliedKeyword) || hasActiveFilterValues(filters, filterValues);

  // 删除/筛选导致总数缩水时，把越界的页码拉回最后一页；用 isSuccess 避免
  // 加载中 total=0 把用户刚点的第 3 页立刻重置成第 1 页。
  useEffect(() => {
    if (query.isSuccess && page > pageCount) setPage(pageCount);
  }, [query.isSuccess, page, pageCount]);

  // ---- 统一排序模式（仅 sortable 页面启用） ----
  const [sortPreview, setSortPreview] = useState<Record<string, string[]>>({});
  const [sortSaving, setSortSaving] = useState(false);
  const [dragState, setDragState] = useState<{
    pointerId: number;
    id: string;
    group: string;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);

  const sortListQuery = useQuery({
    queryKey: [prefix, "sort-all", sortable?.kind, sortable?.listOrderBy ?? defaultOrderBy],
    queryFn: () => api.list({ _orderBy: sortable?.listOrderBy ?? defaultOrderBy }),
    enabled: Boolean(sortable),
    staleTime: 5_000,
  });

  const baseOrderMap = useMemo(
    () => (sortable ? buildSortOrderMap(sortListQuery.data ?? [], sortable) : new Map<string, string[]>()),
    [sortListQuery.data, sortable],
  );

  const sortSequence = useMemo(() => {
    const effective = new Map(baseOrderMap);
    for (const [key, ids] of Object.entries(sortPreview)) effective.set(key, ids);
    return buildSortSequence(effective);
  }, [baseOrderMap, sortPreview]);

  const displayRows = useMemo(
    () => (sortable ? applySortPreview(rows, sortable, sortPreview) : rows),
    [rows, sortable, sortPreview],
  );

  // 有筛选条件时禁止排序：避免只对筛选后的子集提交完整顺序。
  const sortEnabled = Boolean(sortable) && !hasActiveFilters && !sortSaving;

  const orderOf = (group: string): string[] => sortPreview[group] ?? baseOrderMap.get(group) ?? [];

  const submitSort = async (group: string, ids: string[]) => {
    // 上一个 reorder 未结束时不叠加新请求，避免旧响应覆盖新顺序。
    if (sortBusyRef.current) return;
    sortBusyRef.current = true;
    setSortSaving(true);
    try {
      await api.reorder(ids);
      await sortListQuery.refetch();
      await query.refetch();
      setSortPreview((current) => {
        const next = { ...current };
        delete next[group];
        return next;
      });
      toast.success("排序已保存");
    } catch (error) {
      // 失败回滚：丢弃乐观顺序并重新拉取服务端真实顺序
      setSortPreview((current) => {
        const next = { ...current };
        delete next[group];
        return next;
      });
      await sortListQuery.refetch();
      await query.refetch();
      toast.error(error instanceof Error ? error.message : "排序保存失败，已恢复为服务端顺序");
    } finally {
      setSortSaving(false);
      sortBusyRef.current = false;
    }
  };

  const moveRow = (row: T, delta: number) => {
    if (!sortable || !sortEnabled || sortBusyRef.current) return;
    const group = sortGroupKey(row, sortable);
    const ids = orderOf(group);
    const next = swapSortId(ids, row.id, delta);
    if (!next) return;
    setSortPreview((current) => ({ ...current, [group]: next }));
    void submitSort(group, next);
  };

  const beginDrag = (row: T, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!sortable || !sortEnabled) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({
      pointerId: event.pointerId,
      id: row.id,
      group: sortGroupKey(row, sortable),
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    });
  };

  const dragOver = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!sortable || !dragState || event.pointerId !== dragState.pointerId) return;
    if (!dragState.moved && Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY) < 6) {
      return;
    }
    const targetElement = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-sort-row-id]");
    const targetId = targetElement?.getAttribute("data-sort-row-id");
    if (!targetId || targetId === dragState.id) {
      setDragState((current) => (current ? { ...current, moved: true } : current));
      return;
    }
    const targetRow = displayRows.find((row) => row.id === targetId);
    if (!targetRow || sortGroupKey(targetRow, sortable) !== dragState.group) return;
    const ids = orderOf(dragState.group);
    const targetIndex = ids.indexOf(targetId);
    if (targetIndex < 0) return;
    const next = moveSortIdTo(ids, dragState.id, targetIndex);
    if (!next) return;
    setSortPreview((current) => ({ ...current, [dragState.group]: next }));
    setDragState((current) => (current ? { ...current, moved: true } : current));
  };

  const endDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    const { group, moved } = dragState;
    setDragState(null);
    if (!moved) return;
    const next = sortPreview[group];
    const base = baseOrderMap.get(group) ?? [];
    if (!next || next.join(",") === base.join(",")) {
      setSortPreview((current) => {
        const copy = { ...current };
        delete copy[group];
        return copy;
      });
      return;
    }
    setSortPreview((current) => ({ ...current, [group]: next }));
    void submitSort(group, next);
  };

  const cancelDrag = () => {
    setDragState(null);
    setSortPreview({});
  };

  /**
   * 排序单元格：组内序号 + 拖拽手柄 + 上移/下移。
   * 排序值不在这里编辑，只提交顺序；拖拽使用 Pointer Events，鼠标与触摸都可用。
   */
  const renderSortCell = (row: T) => {
    if (!sortable) return null;
    const group = sortGroupKey(row, sortable);
    const ids = orderOf(group);
    const index = ids.indexOf(row.id);
    const fallback =
      sortable.kind === "number"
        ? sortable.orderValue?.(row)
        : Number((sortable.treeCode?.(row) ?? "").slice(-3));
    const seq = sortSequence.get(row.id) ?? fallback;
    const disabledTitle = hasActiveFilters ? "清除搜索与筛选条件后可调整排序" : "排序数据加载中";
    return (
      <td className="sticky left-0 z-10 w-[112px] whitespace-nowrap border-r border-line bg-surface px-3 py-2.5 align-middle group-hover:bg-sunken/50">
        <div className="flex items-center justify-end gap-1">
          <span className="inline-flex h-5 min-w-7 items-center justify-center rounded bg-sunken px-1 text-[11px] tabular-nums text-muted">
            {Number.isFinite(seq) ? seq : "--"}
          </span>
          <button
            type="button"
            aria-label="拖拽调整排序"
            title={sortEnabled ? "按住拖拽到同组目标位置" : disabledTitle}
            disabled={!sortEnabled}
            onPointerDown={(event) => beginDrag(row, event)}
            onPointerMove={dragOver}
            onPointerUp={endDrag}
            onPointerCancel={cancelDrag}
            className={cn(
              "touch-none rounded p-1 text-muted transition-colors",
              sortEnabled ? "cursor-grab hover:bg-sunken hover:text-ink" : "cursor-not-allowed opacity-40",
              dragState?.id === row.id && "bg-sunken text-ink",
            )}
          >
            <GripVertical size={13} />
          </button>
          <span className="flex flex-col leading-none">
            <button
              type="button"
              aria-label="上移"
              title={sortEnabled ? "上移一位" : disabledTitle}
              disabled={!sortEnabled || index <= 0}
              onClick={() => moveRow(row, -1)}
              className="rounded p-0.5 text-muted transition-colors hover:bg-sunken hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ArrowUp size={10} />
            </button>
            <button
              type="button"
              aria-label="下移"
              title={sortEnabled ? "下移一位" : disabledTitle}
              disabled={!sortEnabled || index < 0 || index >= ids.length - 1}
              onClick={() => moveRow(row, 1)}
              className="rounded p-0.5 text-muted transition-colors hover:bg-sunken hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ArrowDown size={10} />
            </button>
          </span>
        </div>
      </td>
    );
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [prefix] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };
  const reload = () => {
    invalidate();
    setReloadTick((tick) => tick + 1);
  };

  const openCreate = () => {
    // 取消可能仍在途的编辑详情请求，避免旧详情把新建表单顶掉。
    detailRequestRef.current += 1;
    setFormError(null);
    setEditing({ mode: "create", values: defaultsOf(fields) });
  };

  const openEdit = async (row: T) => {
    const requestId = detailRequestRef.current + 1;
    detailRequestRef.current = requestId;
    setFormError(null);
    try {
      const detail = await api.get(row.id);
      // 用户已点了另一行或新建时，丢弃这次旧响应。
      if (detailRequestRef.current !== requestId) return;
      const source = (detail ?? row) as T;
      setEditing({ mode: "edit", row: source, values: toForm(source) });
    } catch (error) {
      if (detailRequestRef.current !== requestId) return;
      toast.error(error instanceof Error ? error.message : `读取「${itemLabel(row)}」详情失败，请重试`);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing) return;

    const error = validateForm(fields, editing.mode, editing.values);
    if (error) {
      setFormError(error);
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const payload = toPayload(editing.values, editing.mode, editing.row);
      if (editing.mode === "create") {
        await api.add(payload);
        toast.success("已创建");
      } else if (editing.row) {
        await api.modify({ id: editing.row.id, ...payload });
        toast.success("已保存");
      }
      setEditing(null);
      reload();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "保存失败，服务端未返回具体原因";
      setFormError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const doRemove = async (row: T) => {
    await api.remove(row.id);
    toast.success("已删除");
    if (rows.length === 1 && page > 1) setPage(page - 1);
    reload();
  };

  const remove = async (row: T) => {
    // 非树形实体走全局确认弹窗；树形实体先查服务端预检，
    // 由确认弹窗展示真实子孙数量与名单，避免前端估算。
    if (sortable?.kind !== "tree") {
      const ok = await confirm({
        title: "删除确认",
        description: `确定删除「${itemLabel(row)}」？此操作不可撤销。`,
        confirmText: "删除",
        tone: "danger",
      });
      if (!ok) return;
      try {
        await doRemove(row);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : `删除「${itemLabel(row)}」失败，服务端未返回具体原因`,
        );
      }
      return;
    }

    const requestId = previewRequestRef.current + 1;
    previewRequestRef.current = requestId;
    setDeleteTarget({ row, loading: true });
    try {
      const preview = await api.deletePreview(row.id);
      if (previewRequestRef.current !== requestId) return;
      if (!preview) throw new Error("删除预检未返回数据");
      setDeleteTarget({ row, preview, loading: false });
    } catch (error) {
      if (previewRequestRef.current !== requestId) return;
      setDeleteTarget({
        row,
        loading: false,
        error: error instanceof Error ? error.message : "删除预检失败，请重试或刷新列表",
      });
    }
  };

  /** 关闭删除弹窗时让在途预检失效，避免响应回来后又把弹窗重新打开。 */
  const closeDelete = () => {
    previewRequestRef.current += 1;
    if (!deleting) setDeleteTarget(null);
  };

  /** 树形删除确认：预检成功且未被引用阻塞时才真正调用删除接口。 */
  const confirmRemove = async () => {
    if (!deleteTarget || deleteTarget.loading || deleteTarget.error) return;
    if (deleteTarget.preview?.blocked) return;
    setDeleting(true);
    try {
      await doRemove(deleteTarget.row);
      setDeleteTarget(null);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : `删除「${itemLabel(deleteTarget.row)}」失败，服务端未返回具体原因`,
      );
    } finally {
      setDeleting(false);
    }
  };

  /** Enter 立即查询：同时取消在途防抖，避免 350ms 后旧值把即时结果覆盖回去。 */
  const applyKeywordNow = () => {
    cancelKeywordTimer();
    setAppliedKeyword(keyword.trim());
    setPage(1);
  };

  /** 清空关键字并立即重置查询（不等待输入防抖）。 */
  const clearKeyword = () => {
    cancelKeywordTimer();
    setKeyword("");
    setAppliedKeyword("");
    setPage(1);
  };

  /** 重置全部非关键字筛选。 */
  const clearFilters = () => {
    setFilterValues({});
    setPage(1);
  };

  /** 更新单个筛选；空值从状态里删除，避免把 `""` / 空日期当成激活条件。 */
  const updateFilter = (name: string, value: CrudFilterValue) => {
    setFilterValues((current) => {
      const next = { ...current };
      const emptyRange =
        typeof value === "object" && value !== null && !(value as CrudDateRange).start && !(value as CrudDateRange).end;
      if (value === undefined || value === "" || emptyRange) delete next[name];
      else next[name] = value;
      return next;
    });
    // 与筛选状态同批更新页码，避免先用旧 page + 新条件发一次请求。
    setPage(1);
  };

  /** 更新表单字段，并处理 resetOn 声明的依赖字段联动清空。 */
  const setFieldValue = (name: string, value: FormValues[string]) => {
    setEditing((current) =>
      current ? { ...current, values: applyFieldChange(fields, current.values, name, value) } : current,
    );
  };

  const visibleFields = editing ? visibleFieldsOf(fields, editing.mode) : [];

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <>
            {toolbarExtra}
            <Button variant="secondary" onClick={reload} disabled={query.isFetching}>
              <RefreshCw size={14} className={query.isFetching ? "animate-spin" : ""} /> 刷新
            </Button>
            {canCreate && (
              <Button variant="primary" onClick={openCreate}>
                <Plus size={15} /> {createLabel}
              </Button>
            )}
          </>
        }
      />

      <section className="overflow-hidden rounded-[14px] border border-line bg-surface shadow-panel">
        {/* 搜索 / 筛选区 */}
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2.5">
          <div className="relative min-w-[220px] max-w-[420px] flex-1">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                if (event.key === "Escape") {
                  clearKeyword();
                  return;
                }
                // 中文输入法回车确认候选词时不要触发查询
                if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  applyKeywordNow();
                }
              }}
              placeholder={keywordPlaceholder(filters, searchPlaceholder)}
              className="h-8 pl-8 pr-8 text-[12.5px]"
            />
            {keyword && (
              <button
                type="button"
                onClick={clearKeyword}
                className="absolute right-0.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted transition-colors hover:bg-sunken hover:text-ink"
                aria-label="清除搜索"
                title="清空关键字并立即重置查询"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* 扩展筛选器：select / boolean / date-range / entity 均由 schema 驱动 */}
          {filters
            ?.filter((f) => f.type !== "keyword")
            .map((def) => (
              <FilterControl
                key={def.name}
                def={def}
                value={filterValues[def.name]}
                prefix={prefix}
                onChange={(value) => updateFilter(def.name, value)}
              />
            ))}

          {hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                clearKeyword();
                clearFilters();
              }}
              title="清空关键字与全部筛选条件并回到第一页"
            >
              <X size={13} /> 重置
            </Button>
          )}

          <span className="ml-auto text-[11.5px] text-muted">共 {total} 条</span>
        </div>

        {query.isLoading ? (
          <Spinner />
        ) : query.isError ? (
          <div className="px-4 py-10 text-center">
            <p className="text-[13px] font-medium text-danger">列表加载失败</p>
            <p className="mt-1 max-w-lg text-[12px] leading-relaxed text-muted">
              {query.error instanceof Error
                ? query.error.message
                : "请求没有返回具体原因，可检查登录状态与服务状态后重试。"}
            </p>
            <Button className="mt-4" variant="secondary" onClick={() => void query.refetch()}>
              重试
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title={hasActiveFilters ? "没有匹配的记录" : "暂无数据"}
            description={
              emptyDescription ??
              (hasActiveFilters
                ? [
                    appliedKeyword ? `关键字「${appliedKeyword}」` : null,
                    hasActiveFilterValues(filters, filterValues) ? "当前筛选条件" : null,
                  ]
                    .filter(Boolean)
                    .join("与") + "下没有记录；可清空关键字或重置筛选后重试。"
                : "服务端还没有返回任何记录；可稍后刷新，或确认当前账号是否有该实体的数据权限。")
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table aria-label={`${title}列表`} className="w-full min-w-[760px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line bg-sunken">
                  {sortable && (
                    <th className="sticky left-0 z-10 w-[112px] whitespace-nowrap border-r border-line bg-sunken px-3 py-2 text-right text-[11.5px] font-medium text-muted">
                      排序
                    </th>
                  )}
                  {columns.map((column, index) => (
                    <th
                      key={column.key}
                      className={cn(
                        "whitespace-nowrap px-3 py-2 text-[11.5px] font-medium text-muted",
                        (column.align === "right" || column.type === "number") && "text-right",
                        !sortable && index === 0 && "sticky left-0 z-10 border-r border-line bg-sunken",
                      )}
                    >
                      {column.label}
                    </th>
                  ))}
                  {(canEdit || canDelete || rowActions) && (
                    <th className="w-px whitespace-nowrap px-3 py-2 text-right text-[11.5px] font-medium text-muted">
                      操作
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row) => (
                  <tr
                    key={row.id}
                    data-sort-row-id={row.id}
                    className={cn(
                      "group border-b border-line/80 last:border-b-0 hover:bg-sunken/50",
                      dragState?.id === row.id && "bg-sunken/70 opacity-70",
                    )}
                  >
                    {renderSortCell(row)}
                    {columns.map((column, index) => {
                      const text = (row as Record<string, unknown>)[column.key];
                      return (
                        <td
                          key={column.key}
                          className={cn(
                            "px-3 py-2.5 align-middle text-[12.5px] text-ink-soft",
                            (column.align === "right" || column.type === "number") && "text-right tabular-nums",
                            !sortable && index === 0 && "sticky left-0 z-10 border-r border-line bg-surface group-hover:bg-sunken/50",
                            column.className,
                          )}
                        >
                          {column.render ? (
                            column.render(row) // 自定义 render 自己决定
                          ) : (
                            <span
                              className={cn(column.truncate && "block max-w-[320px] truncate")}
                              title={column.truncate && text !== null && text !== undefined ? String(text) : undefined}
                            >
                              <CellValue
                                value={text}
                                type={column.type}
                                booleanLabels={column.booleanLabels}
                              />
                            </span>
                          )}
                        </td>
                      );
                    })}
                    {(canEdit || canDelete || rowActions) && (
                      <td className="whitespace-nowrap px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {rowActions?.(row, { reload })}
                          {canEdit && (
                            <Button size="sm" variant="ghost" onClick={() => void openEdit(row)}>
                              编辑
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-danger hover:bg-danger-soft"
                              onClick={() => void remove(row)}
                              aria-label={`删除「${itemLabel(row)}」`}
                              title={`删除「${itemLabel(row)}」`}
                            >
                              <Trash2 size={13} />
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          page={page}
          size={size}
          total={total}
          onChange={setPage}
          onSizeChange={(next) => {
            setSize(next);
            setPage(1);
          }}
        />
      </section>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.mode === "create" ? `${createLabel}${title.replace(/管理$/, "")}` : `编辑${title.replace(/管理$/, "")}`}
        description={
          editing?.mode === "edit" && editing.row
            ? `ID ${editing.row.id}；只提交表单里可见的字段。`
            : "带 * 的字段为必填项。"
        }
        dismissable={false}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>
              取消
            </Button>
            <Button variant="primary" onClick={submit} disabled={saving}>
              {saving ? "保存中…" : "保存"}
            </Button>
          </>
        }
      >
        <form onSubmit={submit} className="grid grid-cols-2 gap-3.5">
          {visibleFields.map((field, index) => {
            const inputId = `${formId}-${fieldKey(field, index)}`;
            const value = editing?.values[field.name];
            const options = resolveFieldOptions(field, editing?.values ?? {}, editing?.mode ?? "create");
            const current = String(value ?? "");
            // 已保存但已停用 / 不在当前候选里的值必须留在下拉中，否则 Select 会静默丢值。
            const staleOption =
              current && !options.some((option) => option.value === current) ? current : null;
            return (
              <div key={fieldKey(field, index)} className={field.span === 2 || field.type === "textarea" ? "col-span-2" : ""}>
                <Field
                  label={field.label}
                  htmlFor={field.type === "switch" ? undefined : inputId}
                  required={field.required}
                  hint={field.hint}
                >
                  {field.type === "switch" ? (
                    <div className="flex h-9 items-center">
                      <Switch
                        checked={Boolean(value)}
                        disabled={field.disabled}
                        onChange={(checked) => setFieldValue(field.name, checked)}
                        label={Boolean(value) ? "启用" : "停用"}
                      />
                    </div>
                  ) : field.type === "select" ? (
                    <Select
                      id={inputId}
                      value={current}
                      onChange={(event) => setFieldValue(field.name, event.target.value)}
                      required={field.required}
                      disabled={field.disabled}
                    >
                      <option value="">请选择</option>
                      {staleOption && (
                        <option value={staleOption}>{staleOption}（当前值，已不在可选列表）</option>
                      )}
                      {options.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  ) : field.type === "textarea" ? (
                    <Textarea
                      id={inputId}
                      value={current}
                      placeholder={field.placeholder}
                      disabled={field.disabled}
                      onChange={(event) => setFieldValue(field.name, event.target.value)}
                    />
                  ) : (
                    <Input
                      id={inputId}
                      type={field.type === "password" ? "password" : field.type === "number" ? "number" : "text"}
                      value={current}
                      placeholder={field.placeholder}
                      required={field.required}
                      disabled={field.disabled}
                      autoComplete={field.type === "password" ? "new-password" : "off"}
                      onChange={(event) => setFieldValue(field.name, event.target.value)}
                    />
                  )}
                </Field>
              </div>
            );
          })}
          {formError && (
            <div role="alert" className="col-span-2 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-[12px] text-danger">
              {formError}
            </div>
          )}
          <button type="submit" className="hidden" />
        </form>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={closeDelete}
        title={`删除${title.replace(/管理$/, "")}`}
        description={
          deleteTarget
            ? `确定删除「${itemLabel(deleteTarget.row)}」？此操作不可撤销。`
            : undefined
        }
        footer={
          <>
            <Button variant="ghost" onClick={closeDelete} disabled={deleting}>
              取消
            </Button>
            <Button
              variant="danger"
              onClick={confirmRemove}
              disabled={
                deleting ||
                Boolean(deleteTarget?.loading) ||
                Boolean(deleteTarget?.error) ||
                Boolean(deleteTarget?.preview?.blocked)
              }
            >
              {deleting ? "删除中…" : "删除"}
            </Button>
          </>
        }
      >
        {deleteTarget?.loading && (
          <div className="rounded-lg border border-line bg-sunken px-3 py-2 text-[12.5px] text-muted">
            正在检查子节点…
          </div>
        )}
        {deleteTarget?.error && (
          <div className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-[12.5px] text-danger">
            删除预检失败：{deleteTarget.error}
          </div>
        )}
        {deleteTarget && !deleteTarget.loading && !deleteTarget.error && deleteTarget.preview && (
          <div className="space-y-2.5">
            {deleteTarget.preview.blocked ? (
              <div className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-[12.5px] leading-relaxed text-danger">
                无法删除：{deleteTarget.preview.blockReason}
              </div>
            ) : deleteTarget.preview.count > 0 ? (
              <>
                <div className="rounded-lg border border-line bg-sunken px-3 py-2 text-[12.5px] text-ink">
                  将同时删除 {deleteTarget.preview.count} 个子节点，它们也会一并移除。
                </div>
                <div className="max-h-40 overflow-auto rounded-lg border border-line px-3 py-2 text-[12px] leading-relaxed text-muted">
                  {deleteTarget.preview.items.map((item) => item.name).join("、")}
                </div>
              </>
            ) : (
              <div className="rounded-lg border border-line bg-sunken px-3 py-2 text-[12.5px] text-muted">
                该节点没有子节点，删除后同父节点下的后续兄弟会自动前移。
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
