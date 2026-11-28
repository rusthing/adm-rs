import type { CrudColumn, CrudField } from "@/components/crud/CrudPage";
import { CrudPage } from "@/components/crud/CrudPage";
import type { AdmPersonTagTypeVo, FormValues } from "@/lib/types";

function optionalText(value: FormValues[string]): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  // 空串显式传 null：ModifyDto 的 Option<String> 用 Some(None) 表达清空
  return text ? text : null;
}

const columns: CrudColumn<AdmPersonTagTypeVo>[] = [
  {
    key: "name",
    label: "标签类型",
    className: "whitespace-nowrap",
    render: (row) => <span className="font-medium text-ink">{row.name}</span>,
  },
  {
    key: "code",
    label: "编码",
    className: "whitespace-nowrap",
    render: (row) => <code className="font-mono text-[11.5px] text-ink-soft">{row.code}</code>,
  },
  { key: "remark", label: "备注", truncate: true },
  { key: "enabled", label: "启用", className: "whitespace-nowrap", toggle: {} },
];

const fields: CrudField[] = [
  {
    name: "code",
    label: "编码",
    required: true,
    placeholder: "全局唯一，建议用英文小写下划线",
    hint: "编码用于标签类型的稳定标识，创建后不要改。",
  },
  { name: "name", label: "名称", required: true, placeholder: "如 技能 / 岗位 / 安全" },
  { name: "remark", label: "备注", type: "textarea" },
];

/**
 * 人员标签类型是人员标签（`adm_person.tags`）的分类口径。
 * 标签本身仍按名称自由写入，字典是弱引用：这里停用或删除类型不会影响已有标签，
 * 只影响后续建档时可选的口径。
 */
export function PersonTagTypesPage() {
  const toForm = (row: AdmPersonTagTypeVo): FormValues => ({
    code: row.code,
    name: row.name,
    remark: row.remark ?? "",
  });

  const toPayload = (values: FormValues) => ({
    code: String(values.code ?? "").trim(),
    name: String(values.name ?? "").trim(),
    remark: optionalText(values.remark),
  });

  return (
    <CrudPage<AdmPersonTagTypeVo>
      title="人员标签类型"
      subtitle="维护人员标签的分类，如技能、岗位、安全。"
      prefix="/adm/person-tag-type"
      columns={columns}
      fields={fields}
      itemLabel={(row) => row.name}
      defaultOrderBy="sort_order:asc"
      sortable={{ kind: "number", orderValue: (row) => row.sortOrder }}
      searchPlaceholder="搜索类型名 / 编码 / 备注"
      filters={[{ type: "boolean", name: "enabled", label: "启用" }]}
      createLabel="新建人员标签类型"
      emptyDescription="还没有人员标签类型。先建几个常用口径，维护人员标签时才有统一分类可选。"
      toForm={toForm}
      toPayload={toPayload}
    />
  );
}
