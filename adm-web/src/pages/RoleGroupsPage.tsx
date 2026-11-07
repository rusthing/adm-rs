import { Plus } from "lucide-react";
import type { CrudColumn, CrudField } from "@/components/crud/CrudPage";
import { CrudPage } from "@/components/crud/CrudPage";
import { Button } from "@/components/ui/primitives";
import type { AdmRoleGroupVo, FormValues } from "@/lib/types";
import { useRoleGroupOptions } from "@/lib/queries";

function optionalText(value: FormValues[string]): string | undefined {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text : undefined;
}

/**
 * 角色分组是全局功能配置，全局只有一棵树（treeCode 全局唯一），与领域无关。
 * 领域只用于划分用户/组织的数据域，不参与角色、权限、应用的归属。
 */
export function RoleGroupsPage() {
  const groupsQuery = useRoleGroupOptions();

  /** 全局一棵树，父分组列出全部节点；treeCode 由服务端按 parentCode 生成。 */
  const parentOptions = () =>
    (groupsQuery.data ?? []).map((group) => ({
      value: group.treeCode,
      label: `${"　".repeat(Math.max(0, group.treeCode.length / 3 - 1))}${group.name} · ${group.treeCode}`,
    }));

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
    { key: "enabled", label: "启用", toggle: {} },
    { key: "remark", label: "备注", truncate: true },
  ];

  const fields: CrudField[] = [
    {
      name: "parentCode",
      label: "父分组",
      type: "select",
      createOnly: true,
      options: parentOptions,
      hint: "不选则创建根分组，treeCode 由服务端按 parentCode 在全局树内生成。",
    },
    { name: "name", label: "名称", required: true, placeholder: "同一父节点下允许重名，靠 treeCode 区分" },
    { name: "remark", label: "备注", type: "textarea" },
  ];

  const toForm = (row: AdmRoleGroupVo): FormValues => ({
    parentCode: "",
    name: row.name,
    remark: row.remark ?? "",
  });

  const toPayload = (values: FormValues, mode: "create" | "edit") => {
    const base: Record<string, unknown> = {
      name: String(values.name ?? "").trim(),
      remark: optionalText(values.remark),
    };
    if (mode === "create") base.parentCode = optionalText(values.parentCode);
    return base;
  };

  return (
    <CrudPage<AdmRoleGroupVo>
      title="角色分组"
      subtitle="角色分组是全局的多层树，角色挂在分组下，与领域无关。行内「添加子级」会预填父分组；treeCode 全局唯一，由服务端按 parentCode 生成。"
      prefix="/adm/role-group"
      columns={columns}
      fields={fields}
      itemLabel={(row) => row.name}
      defaultOrderBy="tree_code:asc"
      sortable={{ kind: "tree", treeCode: (row) => row.treeCode }}
      searchPlaceholder="搜索分组名 / 备注"
      filters={[{ type: "boolean", name: "enabled", label: "启用" }]}
      createLabel="新建分组"
      emptyDescription="还没有分组。先建根分组，再用行内「添加子级」逐级补齐。"
      rowActions={(row, { openCreate, canCreate }) =>
        canCreate ? (
          <Button
            size="sm"
            variant="ghost"
            title={`在「${row.name}」（${row.treeCode}）下新建子分组`}
            onClick={() => {
              openCreate(
                { parentCode: row.treeCode },
                `将在「${row.name}」· ${row.treeCode} 下创建子分组，父分组已预填。`,
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
