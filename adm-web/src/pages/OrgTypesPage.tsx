import type { CrudColumn, CrudField } from "@/components/crud/CrudPage";
import { CrudPage } from "@/components/crud/CrudPage";
import type { AdmOrgTypeVo, FormValues } from "@/lib/types";

function optionalText(value: FormValues[string]): string | undefined {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text : undefined;
}

const columns: CrudColumn<AdmOrgTypeVo>[] = [
  {
    key: "name",
    label: "组织类型",
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
    hint: "编码用于组织数据的分类标识，创建后不要改。",
  },
  { name: "name", label: "名称", required: true, placeholder: "如 集团 / 分公司 / 部门" },
  { name: "remark", label: "备注", type: "textarea" },
];

/**
 * 组织类型是组织档案的分类字典：组织在「组织管理」里选一个类型，
 * 类型本身不参与鉴权，也不与领域绑定。
 */
export function OrgTypesPage() {
  const toForm = (row: AdmOrgTypeVo): FormValues => ({
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
    <CrudPage<AdmOrgTypeVo>
      title="组织类型"
      subtitle="组织类型是组织档案的分类字典（集团 / 分公司 / 部门…）。组织在「组织管理」里选一个类型，类型本身不参与鉴权，与领域无关。"
      prefix="/adm/org-type"
      columns={columns}
      fields={fields}
      itemLabel={(row) => row.name}
      defaultOrderBy="sort_order:asc"
      sortable={{ kind: "number", orderValue: (row) => row.sortOrder }}
      searchPlaceholder="搜索类型名 / 编码 / 备注"
      filters={[{ type: "boolean", name: "enabled", label: "启用" }]}
      createLabel="新建组织类型"
      emptyDescription="还没有组织类型。先建几个常用类型，组织建档时才有分类可选。"
      toForm={toForm}
      toPayload={toPayload}
    />
  );
}
