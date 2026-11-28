import type { CrudColumn, CrudField } from "@/components/crud/CrudPage";
import { CrudPage } from "@/components/crud/CrudPage";
import type { AdmPersonTypeVo, FormValues } from "@/lib/types";

function optionalText(value: FormValues[string]): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  // 空串显式传 null：ModifyDto 的 Option<String> 用 Some(None) 表达清空
  return text ? text : null;
}

const columns: CrudColumn<AdmPersonTypeVo>[] = [
  {
    key: "name",
    label: "类型名称",
    className: "whitespace-nowrap",
    render: (row) => <span className="font-medium text-ink">{row.name}</span>,
  },
  {
    key: "value",
    label: "值",
    type: "number",
    className: "whitespace-nowrap",
    render: (row) => <code className="font-mono text-[11.5px] text-ink-soft">{row.value}</code>,
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
  { name: "value", label: "值", type: "number", required: true, placeholder: "如 0", hint: "人员档案的 person_type 存这个值，取值需与旧字典一致。" },
  { name: "code", label: "编码", required: true, placeholder: "如 INTERNAL_EMPLOYEES" },
  { name: "name", label: "名称", required: true, placeholder: "如 柳化内部员工" },
  { name: "remark", label: "备注", type: "textarea" },
];

/**
 * 人员类型字典来自旧 ADM 的 DTW_LOCATION_LOGO_TYPE 人员项（0-3），
 * 人员档案只存字典 value，不存主键。
 */
export function PersonTypesPage() {
  const toForm = (row: AdmPersonTypeVo): FormValues => ({
    value: String(row.value),
    code: row.code,
    name: row.name,
    remark: row.remark ?? "",
  });

  const toPayload = (values: FormValues) => ({
    value: Number(values.value),
    code: String(values.code ?? "").trim(),
    name: String(values.name ?? "").trim(),
    remark: optionalText(values.remark),
  });

  return (
    <CrudPage<AdmPersonTypeVo>
      title="人员类型"
      subtitle="维护人员类型，如内部员工、外包人员、访客。"
      prefix="/adm/person-type"
      columns={columns}
      fields={fields}
      itemLabel={(row) => row.name}
      defaultOrderBy="value:asc"
      searchPlaceholder="搜索编码 / 名称 / 备注"
      filters={[{ type: "boolean", name: "enabled", label: "启用" }]}
      createLabel="新建人员类型"
      emptyDescription="还没有人员类型。人员建档时可以从这里维护的类型里选择归属。"
      toForm={toForm}
      toPayload={toPayload}
    />
  );
}
