import type { CrudColumn, CrudField } from "@/components/crud/CrudPage";
import { CrudPage } from "@/components/crud/CrudPage";
import type { AdmRealmVo, FormValues } from "@/lib/types";

function optionalText(value: FormValues[string]): string | undefined {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text : undefined;
}

const columns: CrudColumn<AdmRealmVo>[] = [
  { key: "name", label: "领域", render: (row) => <span className="font-medium text-ink">{row.name}</span> },
  { key: "code", label: "编码", render: (row) => <code className="font-mono text-[11.5px] text-ink-soft">{row.code}</code> },
  { key: "remark", label: "备注", truncate: true },
  { key: "enabled", label: "启用", toggle: {} },
];

const fields: CrudField[] = [
  { name: "code", label: "编码", required: true, placeholder: "全局唯一，创建后不改", hint: "数据域与迁移脚本都按 code 定位领域。" },
  { name: "name", label: "名称", required: true, placeholder: "全局唯一，展示用" },
  { name: "remark", label: "备注", type: "textarea" },
];

export function RealmsPage() {
  const toForm = (row: AdmRealmVo): FormValues => ({
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
    <CrudPage<AdmRealmVo>
      title="领域管理"
      subtitle="领域是用户与组织的数据域划分单位：决定用户/组织归属与角色的数据可见范围；应用、菜单、角色、权限是全局配置，与领域无关。"
      prefix="/adm/realm"
      columns={columns}
      fields={fields}
      itemLabel={(row) => row.name}
      defaultOrderBy="sort_order:asc"
      sortable={{ kind: "number", orderValue: (row) => row.sortOrder }}
      searchPlaceholder="搜索领域名 / 编码"
      filters={[{ type: "boolean", name: "enabled", label: "启用" }]}
      emptyDescription="种子只带一个「平台」领域（platform）。用户与组织要按数据域隔离时，再在这里补建领域。"
      toForm={toForm}
      toPayload={toPayload}
    />
  );
}
