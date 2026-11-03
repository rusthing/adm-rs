import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { realmApi } from "@/lib/api";
import type { CrudColumn, CrudField } from "@/components/crud/CrudPage";
import { CrudPage } from "@/components/crud/CrudPage";
import type { AdmAppVo, FormValues } from "@/lib/types";

function optionalText(value: FormValues[string]): string | undefined {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text : undefined;
}

export function AppsPage() {
  const realmsQuery = useQuery({
    queryKey: ["realm", "options"],
    queryFn: () => realmApi.list({ _orderBy: "sort_order:asc" }),
    staleTime: 30_000,
  });

  const realmName = useMemo(() => {
    const map = new Map<string, string>();
    for (const realm of realmsQuery.data ?? []) map.set(realm.id, realm.name);
    return map;
  }, [realmsQuery.data]);

  const columns: CrudColumn<AdmAppVo>[] = [
    { key: "name", label: "应用", render: (row) => <span className="font-medium text-ink">{row.name}</span> },
    { key: "code", label: "编码", render: (row) => <code className="font-mono text-[11.5px] text-ink-soft">{row.code}</code> },
    { key: "realmId", label: "领域", render: (row) => (row.realmId ? realmName.get(row.realmId) ?? `#${row.realmId}` : "--") },
    { key: "sortOrder", label: "排序", align: "right", render: (row) => <span className="tnum font-mono text-[11.5px]">{row.sortOrder}</span> },
    { key: "enabled", label: "启用", type: "boolean", booleanLabels: { on: "启用", off: "停用" } },
  ];

  const fields: CrudField[] = [
    {
      name: "realmId",
      label: "归属领域",
      type: "select",
      options: (realmsQuery.data ?? []).map((realm) => ({ value: realm.id, label: `${realm.name}（${realm.code}）` })),
      hint: "可留空表示跨领域通用应用。",
    },
    { name: "code", label: "应用编码", required: true, placeholder: "全局唯一，如 adm-console" },
    { name: "name", label: "名称", required: true, placeholder: "全局唯一" },
    { name: "sortOrder", label: "排序", type: "number", required: true, defaultValue: "0" },
    { name: "enabled", label: "启用", type: "switch", defaultValue: true },
    { name: "remark", label: "备注", type: "textarea" },
  ];

  const toForm = (row: AdmAppVo): FormValues => ({
    realmId: row.realmId ?? "",
    code: row.code,
    name: row.name,
    sortOrder: String(row.sortOrder ?? 0),
    enabled: row.enabled,
    remark: row.remark ?? "",
  });

  const toPayload = (values: FormValues) => ({
    realmId: optionalText(values.realmId),
    code: String(values.code ?? "").trim(),
    name: String(values.name ?? "").trim(),
    sortOrder: Number(values.sortOrder ?? 0),
    enabled: Boolean(values.enabled),
    remark: optionalText(values.remark),
  });

  return (
    <CrudPage<AdmAppVo>
      title="应用管理"
      subtitle="菜单树归属于应用：同一个领域可以有后台、前台、移动端等多个应用，每个应用一棵菜单树。"
      prefix="/adm/app"
      columns={columns}
      fields={fields}
      itemLabel={(row) => row.name}
      defaultOrderBy="sort_order:asc"
      searchPlaceholder="搜索应用名 / 编码"
      filters={[
        {
          type: "select",
          name: "realm_id",
          label: "领域",
          options: (realmsQuery.data ?? []).map((realm) => ({ value: realm.id, label: realm.name })),
        },
        { type: "boolean", name: "enabled", label: "启用" },
      ]}
      emptyDescription="后端种子没有应用行。先建应用，再到「菜单管理」建菜单树。"
      toForm={toForm}
      toPayload={toPayload}
    />
  );
}
