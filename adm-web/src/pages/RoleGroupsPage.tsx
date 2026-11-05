import { useMemo } from "react";
import { Plus } from "lucide-react";
import type { CrudColumn, CrudField } from "@/components/crud/CrudPage";
import { CrudPage } from "@/components/crud/CrudPage";
import { Button } from "@/components/ui/primitives";
import type { AdmRoleGroupVo, FormValues } from "@/lib/types";
import { useRealmOptions, useRoleGroupOptions } from "@/lib/queries";
import { shortId } from "@/lib/utils";

function optionalText(value: FormValues[string]): string | undefined {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text : undefined;
}

export function RoleGroupsPage() {
  const realmsQuery = useRealmOptions();
  const groupsQuery = useRoleGroupOptions();

  const realmName = useMemo(() => {
    const map = new Map<string, string>();
    for (const realm of realmsQuery.data ?? []) map.set(realm.id, realm.name);
    return map;
  }, [realmsQuery.data]);

  /** 父分组只列同一领域下的节点：treeCode 按领域隔离，跨领域选父会被服务端拒绝。 */
  const parentOptions = (values: FormValues) => {
    const realmId = String(values.realmId ?? "");
    return (groupsQuery.data ?? [])
      .filter((group) => !realmId || group.realmId === realmId)
      .map((group) => ({
        value: group.treeCode,
        label: `${"　".repeat(Math.max(0, group.treeCode.length / 3 - 1))}${group.name} · ${group.treeCode}`,
      }));
  };

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
    {
      key: "realmId",
      label: "领域",
      render: (row) =>
        row.realmId ? realmName.get(row.realmId) ?? shortId(row.realmId) : "--",
    },
    { key: "enabled", label: "启用", type: "boolean", booleanLabels: { on: "启用", off: "停用" } },
    { key: "remark", label: "备注", truncate: true },
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
      resetOn: ["realmId"],
      hint: "只列出同一领域下的分组；不选则创建根分组，treeCode 由服务端按 parentCode 生成。",
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
      subtitle="角色分组是领域内的多层树，角色挂在分组下。左侧按领域切换，行内「添加子级」会预填领域与父分组；treeCode 由服务端按 parentCode 生成。"
      prefix="/adm/role-group"
      columns={columns}
      fields={fields}
      itemLabel={(row) => row.name}
      defaultOrderBy="tree_code:asc"
      sortable={{ kind: "tree", treeCode: (row) => row.treeCode, scope: (row) => row.realmId }}
      searchPlaceholder="搜索分组名 / 备注"
      scope={{
        title: "领域",
        param: "realm_id",
        field: "realmId",
        options: (realmsQuery.data ?? []).map((realm) => ({
          value: realm.id,
          label: realm.name,
          description: realm.code,
          disabled: !realm.enabled,
        })),
        loading: realmsQuery.isLoading,
        emptyText: "还没有领域，请先到「领域管理」创建。",
        hint: "treeCode 只在领域内唯一；两个及以上领域时才显示此分组栏。",
      }}
      filters={[{ type: "boolean", name: "enabled", label: "启用" }]}
      createLabel="新建分组"
      emptyDescription="该领域下还没有分组。先建根分组，再用行内「添加子级」逐级补齐。"
      rowActions={(row, { openCreate, setScope, canCreate }) =>
        canCreate ? (
          <Button
            size="sm"
            variant="ghost"
            title={`在「${row.name}」（${row.treeCode}）下新建子分组`}
            onClick={() => {
              setScope(row.realmId);
              openCreate(
                { realmId: row.realmId, parentCode: row.treeCode },
                `将在「${row.name}」· ${row.treeCode} 下创建子分组，所属领域与父分组已预填。`,
              );
            }}
          >
            <Plus size={13} /> 添加子级
          </Button>
        ) : null
      }
      toForm={toForm}
      toPayload={toPayload}
    />
  );
}
