import type { CrudColumn, CrudField } from "@/components/crud/CrudPage";
import { CrudPage } from "@/components/crud/CrudPage";
import type { AdmPersonCodeTypeVo, FormValues } from "@/lib/types";

function optionalText(value: FormValues[string]): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  // 空串显式传 null：ModifyDto 的 Option<String> 用 Some(None) 表达清空
  return text ? text : null;
}

const columns: CrudColumn<AdmPersonCodeTypeVo>[] = [
  {
    key: "name",
    label: "编码类型",
    className: "whitespace-nowrap",
    render: (row) => <span className="font-medium text-ink">{row.name}</span>,
  },
  { key: "remark", label: "备注", truncate: true },
  { key: "enabled", label: "启用", className: "whitespace-nowrap", toggle: {} },
];

const fields: CrudField[] = [
  { name: "name", label: "名称", required: true, placeholder: "如 工号 / 学号" },
  { name: "remark", label: "备注", type: "textarea" },
];

/**
 * 人员编码类型决定「人员档案里的 code 是什么号」：工号、学号、外协编号……
 * 一个人员最多挂一个编码类型；(code_type_id, code) 唯一。
 */
export function PersonCodeTypesPage() {
  const toForm = (row: AdmPersonCodeTypeVo): FormValues => ({
    name: row.name,
    remark: row.remark ?? "",
  });

  const toPayload = (values: FormValues) => ({
    name: String(values.name ?? "").trim(),
    remark: optionalText(values.remark),
  });

  return (
    <CrudPage<AdmPersonCodeTypeVo>
      title="人员编码类型"
      subtitle="维护人员编号的类型，如工号、学号、外协编号。"
      prefix="/adm/person-code-type"
      columns={columns}
      fields={fields}
      itemLabel={(row) => row.name}
      defaultOrderBy="sort_order:asc"
      sortable={{ kind: "number", orderValue: (row) => row.sortOrder }}
      searchPlaceholder="搜索类型名 / 备注"
      filters={[{ type: "boolean", name: "enabled", label: "启用" }]}
      createLabel="新建编码类型"
      emptyDescription="还没有编码类型。先建「工号」这类类型，人员建档时才能填编号。"
      toForm={toForm}
      toPayload={toPayload}
    />
  );
}
