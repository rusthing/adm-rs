import { useEffect, useMemo, useState } from "react";
import type { FormEvent, KeyboardEvent, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import { crudApi } from "@/lib/api";
import type { CrudApi } from "@/lib/api";
import type { FormValues, PageQuery } from "@/lib/types";
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
import { Modal, useToast } from "@/components/ui/overlay";
import { CellValue } from "./cells";
import type { BooleanCellLabels, CrudCellType } from "./cells";
import {
  buildFilterParams,
  hasActiveFilterValues,
  keywordParamName,
  keywordPlaceholder,
} from "./filters";
import type { CrudDateRange, CrudFilterDef, CrudFilterValue, CrudFilterValues } from "./filters";

export type FormMode = "create" | "edit";

export type { CrudCellType } from "./cells";
export type { CrudFilterDef, CrudFilterType, CrudFilterOption } from "./filters";

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
}

export interface CrudFieldOption {
  value: string;
  label: string;
}

export interface CrudField {
  name: string;
  label: string;
  type?: "text" | "textarea" | "switch" | "select" | "password" | "number";
  required?: boolean;
  placeholder?: string;
  hint?: string;
  options?: CrudFieldOption[];
  span?: 2;
  createOnly?: boolean;
  editOnly?: boolean;
  defaultValue?: string | boolean;
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

function defaultsOf(fields: CrudField[]): FormValues {
  const values: FormValues = {};
  for (const field of fields) {
    if (field.type === "switch") values[field.name] = Boolean(field.defaultValue);
    else values[field.name] = field.defaultValue === undefined ? "" : String(field.defaultValue);
  }
  return values;
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
}: CrudPageProps<T>) {
  const api = useMemo<CrudApi<T>>(() => crudApi<T>(prefix), [prefix]);
  const queryClient = useQueryClient();
  const toast = useToast();

  const [page, setPage] = useState(1);
  const [size, setSize] = useState(20);
  const [keyword, setKeyword] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [reloadTick, setReloadTick] = useState(0);

  const [filterValues, setFilterValues] = useState<CrudFilterValues>({});

  const [editing, setEditing] = useState<{ mode: FormMode; row?: T; values: FormValues } | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const keywordName = keywordParamName(filters);
  const filterParams = useMemo(() => buildFilterParams(filters, filterValues), [filters, filterValues]);
  const filterKey = JSON.stringify(filterParams);
  const extraKey = JSON.stringify(extraQuery ?? {});

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAppliedKeyword(keyword.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [keyword]);

  useEffect(() => {
    // 筛选器变化时回第一页
    setPage(1);
  }, [filterKey]);

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

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [prefix] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };
  const reload = () => {
    invalidate();
    setReloadTick((tick) => tick + 1);
  };

  const openCreate = () => {
    setFormError(null);
    setEditing({ mode: "create", values: defaultsOf(fields) });
  };

  const openEdit = async (row: T) => {
    setFormError(null);
    try {
      const detail = await api.get(row.id);
      const source = (detail ?? row) as T;
      setEditing({ mode: "edit", row: source, values: toForm(source) });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "读取详情失败");
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing) return;

    const visibleFields = fields.filter((field) => {
      if (field.createOnly && editing.mode !== "create") return false;
      if (field.editOnly && editing.mode !== "edit") return false;
      return true;
    });
    for (const field of visibleFields) {
      if (!field.required) continue;
      const value = editing.values[field.name];
      if (typeof value === "string" && !value.trim()) {
        setFormError(`请填写「${field.label}」`);
        return;
      }
      if (value === undefined || value === "") {
        setFormError(`请填写「${field.label}」`);
        return;
      }
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
      const message = error instanceof Error ? error.message : "保存失败";
      setFormError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: T) => {
    if (!window.confirm(`确定删除「${itemLabel(row)}」？此操作不可撤销。`)) return;
    try {
      await api.remove(row.id);
      toast.success("已删除");
      if (rows.length === 1 && page > 1) setPage(page - 1);
      reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败");
    }
  };

  /** 清空关键字并立即重置查询（不等待输入防抖）。 */
  const clearKeyword = () => {
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
  };

  const visibleFields = editing
    ? fields.filter((field) => {
        if (field.createOnly && editing.mode !== "create") return false;
        if (field.editOnly && editing.mode !== "edit") return false;
        return true;
      })
    : [];

  const hasActiveFilters = Boolean(appliedKeyword) || hasActiveFilterValues(filters, filterValues);

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
                if (event.key === "Escape") clearKeyword();
              }}
              placeholder={keywordPlaceholder(filters, searchPlaceholder)}
              className="h-8 pl-8 pr-8 text-[12.5px]"
            />
            {keyword && (
              <button
                type="button"
                onClick={clearKeyword}
                className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted transition-colors hover:bg-sunken hover:text-ink"
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
            <p className="text-[13px] font-medium text-danger">加载失败</p>
            <p className="mt-1 text-[12px] text-muted">
              {query.error instanceof Error ? query.error.message : "未知错误"}
            </p>
            <Button className="mt-4" variant="secondary" onClick={() => void query.refetch()}>
              重试
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="暂无数据"
            description={
              emptyDescription ??
              (hasActiveFilters ? `没有匹配当前筛选条件的记录。` : "后端还没有这类数据，或当前筛选条件下为空。")
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line bg-sunken/70">
                  {columns.map((column) => (
                    <th
                      key={column.key}
                      className={cn(
                        "whitespace-nowrap px-3 py-2 text-[11.5px] font-medium text-muted",
                        column.align === "right" && "text-right",
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
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-line/80 last:border-b-0 hover:bg-sunken/50">
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={cn(
                          "px-3 py-2.5 align-middle text-[12.5px] text-ink-soft",
                          column.align === "right" && "text-right",
                          column.className,
                        )}
                      >
                        {column.render
                          ? column.render(row) // 自定义 render 自己决定
                          : (
                            <CellValue
                              value={(row as Record<string, unknown>)[column.key]}
                              type={column.type}
                              booleanLabels={column.booleanLabels}
                            />
                          )}
                      </td>
                    ))}
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
                            <Button size="sm" variant="ghost" className="text-danger hover:bg-danger-soft" onClick={() => void remove(row)}>
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
            : "带 * 的字段为后端必填项。"
        }
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
          {visibleFields.map((field) => (
            <div key={field.name} className={field.span === 2 || field.type === "textarea" ? "col-span-2" : ""}>
              <Field label={field.label} required={field.required} hint={field.hint}>
                {field.type === "switch" ? (
                  <div className="flex h-9 items-center">
                    <Switch
                      checked={Boolean(editing?.values[field.name])}
                      onChange={(checked) =>
                        setEditing((current) =>
                          current ? { ...current, values: { ...current.values, [field.name]: checked } } : current,
                        )
                      }
                      label={Boolean(editing?.values[field.name]) ? "启用" : "停用"}
                    />
                  </div>
                ) : field.type === "select" ? (
                  <Select
                    value={String(editing?.values[field.name] ?? "")}
                    onChange={(event) =>
                      setEditing((current) =>
                        current
                          ? { ...current, values: { ...current.values, [field.name]: event.target.value } }
                          : current,
                      )
                    }
                    required={field.required}
                  >
                    <option value="">请选择</option>
                    {field.options?.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                ) : field.type === "textarea" ? (
                  <Textarea
                    value={String(editing?.values[field.name] ?? "")}
                    placeholder={field.placeholder}
                    onChange={(event) =>
                      setEditing((current) =>
                        current
                          ? { ...current, values: { ...current.values, [field.name]: event.target.value } }
                          : current,
                      )
                    }
                  />
                ) : (
                  <Input
                    type={field.type === "password" ? "password" : field.type === "number" ? "number" : "text"}
                    value={String(editing?.values[field.name] ?? "")}
                    placeholder={field.placeholder}
                    required={field.required}
                    autoComplete={field.type === "password" ? "new-password" : "off"}
                    onChange={(event) =>
                      setEditing((current) =>
                        current
                          ? { ...current, values: { ...current.values, [field.name]: event.target.value } }
                          : current,
                      )
                    }
                  />
                )}
              </Field>
            </div>
          ))}
          {formError && (
            <div className="col-span-2 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-[12px] text-danger">
              {formError}
            </div>
          )}
          <button type="submit" className="hidden" />
        </form>
      </Modal>
    </div>
  );
}
