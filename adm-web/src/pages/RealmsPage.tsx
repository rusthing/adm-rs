import type { CrudColumn, CrudField } from "@/components/crud/CrudPage";
import { CrudPage } from "@/components/crud/CrudPage";
import { Badge } from "@/components/ui/primitives";
import type { AdmRealmVo, FormValues } from "@/lib/types";

function optionalText(value: FormValues[string]): string | undefined {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text : undefined;
}

const columns: CrudColumn<AdmRealmVo>[] = [
  { key: "name", label: "领域", render: (row) => <span className="font-medium text-ink">{row.name}</span> },
  { key: "code", label: "编码", render: (row) => <code className="font-mono text-[11.5px] text-ink-soft">{row.code}</code> },
  { key: "sortOrder", label: "排序", align: "right", render: (row) => <span className="tnum font-mono text-[11.5px]">{row.sortOrder}</span> },
  { key: "enabled", label: "启用", render: (row) => <Badge tone={row.enabled ? "success" : "warn"}>{row.enabled ? "启用" : "停用"}</Badge> },
  { key: "remark", label: "备注", render: (row) => <span className="text-[11.5px] text-muted">{row.remark || "—"}</span> },
];

const fields: CrudField[] = [
  { name: "code", label: "编码", required: true, placeholder: "全局唯一，创建后不改", hint: "数据隔离与迁移脚本都按 code 定位领域。" },
  { name: "name", label: "名称", required: true, placeholder: "全局唯一，展示用" },
  { name: "sortOrder", label: "排序", type: "number", required: true, defaultValue: "0", hint: "0-9999，越小越靠前。" },
  { name: "enabled", label: "启用", type: "switch", defaultValue: true },
  { name: "remark", label: "备注", type: "textarea" },
];

export function RealmsPage() {
  const toForm = (row: AdmRealmVo): FormValues => ({
    code: row.code,
    name: row.name,
    sortOrder: String(row.sortOrder ?? 0),
    enabled: row.enabled,
    remark: row.remark ?? "",
  });

  const toPayload = (values: FormValues) => ({
    code: String(values.code ?? "").trim(),
    name: String(values.name ?? "").trim(),
    sortOrder: Number(values.sortOrder ?? 0),
    enabled: Boolean(values.enabled),
    remark: optionalText(values.remark),
  });

  return (
    <CrudPage<AdmRealmVo>
      title="领域管理"
      subtitle="领域是权限与数据隔离的顶层单位。角色分组、权限分组、组织与用户都可以按领域隔离。"
      prefix="/adm/realm"
      columns={columns}
      fields={fields}
      itemLabel={(row) => row.name}
      defaultOrderBy="sort_order:asc"
      searchPlaceholder="搜索领域名 / 编码"
      emptyDescription="后端种子没有领域行。建议先建一个默认领域，再建应用与分组。"
      toForm={toForm}
      toPayload={toPayload}
    />
  );
}
