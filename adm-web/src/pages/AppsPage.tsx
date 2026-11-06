import type { CrudColumn, CrudField } from "@/components/crud/CrudPage";
import { CrudPage } from "@/components/crud/CrudPage";
import type { AdmAppVo, FormValues } from "@/lib/types";

function optionalText(value: FormValues[string]): string | undefined {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text : undefined;
}

/**
 * 应用是全局功能配置，与领域无关：
 * 领域只用于划分用户/组织的数据域，不参与应用、菜单、角色、权限的归属与隔离。
 */
export function AppsPage() {
  const columns: CrudColumn<AdmAppVo>[] = [
    { key: "name", label: "应用", render: (row) => <span className="font-medium text-ink">{row.name}</span> },
    { key: "code", label: "编码", render: (row) => <code className="font-mono text-[11.5px] text-ink-soft">{row.code}</code> },
    { key: "enabled", label: "启用", type: "boolean", booleanLabels: { on: "启用", off: "停用" } },
  ];

  const fields: CrudField[] = [
    { name: "code", label: "应用编码", required: true, placeholder: "全局唯一，如 adm-console" },
    { name: "name", label: "名称", required: true, placeholder: "全局唯一" },
    { name: "enabled", label: "启用", type: "switch", defaultValue: true },
    { name: "remark", label: "备注", type: "textarea" },
  ];

  const toForm = (row: AdmAppVo): FormValues => ({
    code: row.code,
    name: row.name,
    enabled: row.enabled,
    remark: row.remark ?? "",
  });

  const toPayload = (values: FormValues) => ({
    code: String(values.code ?? "").trim(),
    name: String(values.name ?? "").trim(),
    enabled: Boolean(values.enabled),
    remark: optionalText(values.remark),
  });

  return (
    <CrudPage<AdmAppVo>
      title="应用管理"
      subtitle="菜单树归属于应用：应用是全局配置，后台、前台、移动端各一棵菜单树，与领域无关。"
      prefix="/adm/app"
      columns={columns}
      fields={fields}
      itemLabel={(row) => row.name}
      defaultOrderBy="sort_order:asc"
      sortable={{ kind: "number", orderValue: (row) => row.sortOrder }}
      searchPlaceholder="搜索应用名 / 编码"
      filters={[{ type: "boolean", name: "enabled", label: "启用" }]}
      emptyDescription="后端种子没有应用行。先建应用，再到「菜单管理」建菜单树。"
      toForm={toForm}
      toPayload={toPayload}
    />
  );
}
