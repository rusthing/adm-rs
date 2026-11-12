import { useMemo } from "react";
import { Plus } from "lucide-react";
import type { CrudColumn, CrudField } from "@/components/crud/CrudPage";
import { CrudPage } from "@/components/crud/CrudPage";
import { Badge, Button } from "@/components/ui/primitives";
import type { AdmPermGroupVo, FormValues } from "@/lib/types";
import { usePermGroupOptions, usePermOptions } from "@/lib/queries";

/** 四层语义固定：平台 → 菜单一级 → 主体 → 操作类型；更深的自建层级不写死名称。 */
const LEVEL_META = [
  { label: "平台", tone: "violet" },
  { label: "菜单一级", tone: "info" },
  { label: "主体", tone: "success" },
  { label: "类型", tone: "neutral" },
] as const;

function optionalText(value: FormValues[string]): string | undefined {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text : undefined;
}

/**
 * 权限分组是全局功能配置，全局只有一棵树（treeCode 全局唯一），与领域无关。
 * 领域只用于划分用户/组织的数据域，不参与角色、权限、应用的归属。
 */
export function PermissionGroupsPage() {
  const groupsQuery = usePermGroupOptions();
  const permsQuery = usePermOptions();

  const groups = useMemo(() => groupsQuery.data ?? [], [groupsQuery.data]);

  /** 每个分组（含子孙）挂了多少权限点：授权前判断「这个主体有没有权限」全靠它。 */
  const permCount = useMemo(() => {
    const byId = new Map(groups.map((group) => [group.id, group]));
    const direct = new Map<string, number>();
    for (const perm of permsQuery.data ?? []) {
      const group = byId.get(perm.groupId);
      if (!group) continue;
      direct.set(group.treeCode, (direct.get(group.treeCode) ?? 0) + 1);
    }
    const rolled = new Map<string, number>();
    for (const group of groups) {
      let total = 0;
      for (const [code, count] of direct) {
        if (code.startsWith(group.treeCode)) total += count;
      }
      rolled.set(group.treeCode, total);
    }
    return rolled;
  }, [groups, permsQuery.data]);

  /** 全局一棵树，父分组列出全部节点；treeCode 由服务端按 parentCode 生成。 */
  const parentOptions = () =>
    (groupsQuery.data ?? []).map((group) => ({
      value: group.treeCode,
      label: `${"　".repeat(Math.max(0, group.treeCode.length / 3 - 1))}${group.name} · ${group.treeCode}`,
    }));

  const columns: CrudColumn<AdmPermGroupVo>[] = [
    {
      key: "name",
      label: "分组",
      className: "whitespace-nowrap",
      render: (row) => {
        const depth = Math.max(0, row.treeCode.length / 3 - 1);
        return (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span className="text-muted/50">{"·".repeat(depth)}</span>
            <span className="font-medium text-ink">{row.name}</span>
            <code className="font-mono text-[10.5px] text-muted">{row.treeCode}</code>
          </span>
        );
      },
    },
    {
      key: "level",
      label: "层级",
      className: "whitespace-nowrap",
      render: (row) => {
        const depth = Math.max(0, row.treeCode.length / 3 - 1);
        const meta = LEVEL_META[depth];
        return meta ? <Badge tone={meta.tone}>{meta.label}</Badge> : <Badge>第 {depth + 1} 层</Badge>;
      },
    },
    {
      key: "permCount",
      label: "权限点",
      className: "whitespace-nowrap",
      align: "right",
      render: (row) => {
        const count = permCount.get(row.treeCode) ?? 0;
        return count > 0 ? (
          <span className="tabular-nums text-ink-soft">{count}</span>
        ) : (
          <span className="tabular-nums text-muted/60">0</span>
        );
      },
    },
    { key: "remark", label: "备注", truncate: true },
    { key: "enabled", label: "启用", className: "whitespace-nowrap", toggle: {} },
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

  const toForm = (row: AdmPermGroupVo): FormValues => ({
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
    <CrudPage<AdmPermGroupVo>
      title="权限分组"
      subtitle="权限分组是全局一棵树，固定四层语义：平台 → 菜单一级 → 主体 → 操作类型，权限点挂在最末层。行内「添加子级」会预填父分组；授权时按「主体 → 类型」展示，主体段可一键全选。"
      prefix="/adm/perm-group"
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
