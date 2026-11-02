import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCw, Search, Trash2 } from "lucide-react";
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

export type FormMode = "create" | "edit";

export interface CrudColumn<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
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
  searchPlaceholder = "按关键字搜索（后端按 QueryDto 的可检索字段匹配）",
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
}: CrudPageProps<T>) {
  const api = useMemo<CrudApi<T>>(() => crudApi<T>(prefix), [prefix]);
  const queryClient = useQueryClient();
  const toast = useToast();

  const [page, setPage] = useState(1);
  const [size, setSize] = useState(20);
  const [keyword, setKeyword] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [reloadTick, setReloadTick] = useState(0);

  const [editing, setEditing] = useState<{ mode: FormMode; row?: T; values: FormValues } | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const extraKey = JSON.stringify(extraQuery ?? {});

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAppliedKeyword(keyword.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [keyword]);

  const query = useQuery({
    queryKey: [prefix, "page", page, size, appliedKeyword, defaultOrderBy, extraKey, reloadTick],
    queryFn: () =>
      api.page({
        _page: page,
        _size: size,
        _keyword: appliedKeyword || undefined,
        _orderBy: defaultOrderBy,
        ...(extraQuery ?? {}),
      }),
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

  const visibleFields = editing
    ? fields.filter((field) => {
        if (field.createOnly && editing.mode !== "create") return false;
        if (field.editOnly && editing.mode !== "edit") return false;
        return true;
      })
    : [];

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
        <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
          <div className="relative min-w-[220px] max-w-[420px] flex-1">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 pl-8 text-[12.5px]"
            />
          </div>
          <span className="text-[11.5px] text-muted">共 {total} 条</span>
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
              (appliedKeyword ? `没有匹配「${appliedKeyword}」的记录。` : "后端还没有这类数据，或当前筛选条件下为空。")
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
                        {column.render ? column.render(row) : String((row as Record<string, unknown>)[column.key] ?? "—")}
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
