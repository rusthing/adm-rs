import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { realmApi, roleGroupApi } from "@/lib/api";
import type { CrudColumn, CrudField } from "@/components/crud/CrudPage";
import { CrudPage } from "@/components/crud/CrudPage";
import type { AdmRoleGroupVo, FormValues } from "@/lib/types";

function optionalText(value: FormValues[string]): string | undefined {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text : undefined;
}

export function RoleGroupsPage() {
  const realmsQuery = useQuery({
    queryKey: ["realm", "options"],
    queryFn: () => realmApi.list({ _orderBy: "sort_order:asc" }),
    staleTime: 30_000,
  });
  const groupsQuery = useQuery({
    queryKey: ["roleGroup", "tree"],
    queryFn: () => roleGroupApi.list({ _orderBy: "tree_code:asc" }),
    staleTime: 30_000,
  });

  const realmName = useMemo(() => {
    const map = new Map<string, string>();
    for (const realm of realmsQuery.data ?? []) map.set(realm.id, realm.name);
    return map;
  }, [realmsQuery.data]);

  const parentOptions = useMemo(
    () =>
      (groupsQuery.data ?? []).map((group) => ({
        value: group.treeCode,
        label: `${"　".repeat(Math.max(0, group.treeCode.length / 3 - 1))}${group.name} · ${group.treeCode}`,
      })),
    [groupsQuery.data],
  );

  const columns: CrudColumn<AdmRoleGroupVo>[] = [
    {
      key: "name",
      label: "分组",
      render: (row) => {
        const depth = Math.max(0, row.treeCode.length / 3 - 1);
        return (
          <span className="inline-flex items-center gap-1.5">
            <span className="text-muted/50">{"·".repeat(depth)}</span>
            <span className="font-medium text-ink">{row.name}</span>
            <code className="font-mono text-[10.5px] text-muted">{row.treeCode}</code>
          </span>
        );
      },
    },
    { key: "realmId", label: "领域", render: (row) => realmName.get(row.realmId) ?? `#${row.realmId}` },
    { key: "enabled", label: "启用", type: "boolean", booleanLabels: { on: "启用", off: "停用" } },
    { key: "remark", label: "备注" },
  ];

  const fields: CrudField[] = [
    {
      name: "realmId",
      label: "所属领域",
      type: "select",
      required: true,
      createOnly: true,
      options: (realmsQuery.data ?? []).map((realm) => ({ value: realm.id, label: `${realm.name}（${realm.code}）` })),
      hint: realmsQuery.data?.length ? "角色树按领域隔离，treeCode 只在领域内唯一。" : "还没有领域，请先到「领域管理」创建。",
    },
    {
      name: "parentCode",
      label: "父分组",
      type: "select",
      createOnly: true,
      options: parentOptions,
      hint: "不选则创建根分组。treeCode 由服务端按 parentCode 生成。",
    },
    { name: "name", label: "名称", required: true, placeholder: "同一父节点下允许重名，靠 treeCode 区分" },
    { name: "enabled", label: "启用", type: "switch", defaultValue: true },
    { name: "remark", label: "备注", type: "textarea" },
  ];

  const toForm = (row: AdmRoleGroupVo): FormValues => ({
    realmId: row.realmId,
    parentCode: "",
    name: row.name,
    enabled: row.enabled,
    remark: row.remark ?? "",
  });

  const toPayload = (values: FormValues, mode: "create" | "edit") => {
    const base: Record<string, unknown> = {
      name: String(values.name ?? "").trim(),
      enabled: Boolean(values.enabled),
      remark: optionalText(values.remark),
    };
    if (mode === "create") {
      base.realmId = values.realmId;
      base.parentCode = optionalText(values.parentCode);
    }
    return base;
  };

  return (
    <CrudPage<AdmRoleGroupVo>
      title="角色分组"
      subtitle="角色分组是领域内的两级树，角色挂在分组下。treeCode 由服务端按 parentCode 生成。"
      prefix="/adm/role-group"
      columns={columns}
      fields={fields}
      itemLabel={(row) => row.name}
      defaultOrderBy="tree_code:asc"
      searchPlaceholder="搜索分组名 / 备注"
      filters={[
        {
          type: "select",
          name: "realm_id",
          label: "领域",
          options: (realmsQuery.data ?? []).map((realm) => ({ value: realm.id, label: realm.name })),
        },
        { type: "boolean", name: "enabled", label: "启用" },
      ]}
      createLabel="新建分组"
      emptyDescription="后端种子没有角色分组。先建领域，再建分组，然后到角色管理里建角色。"
      toForm={toForm}
      toPayload={toPayload}
    />
  );
}
