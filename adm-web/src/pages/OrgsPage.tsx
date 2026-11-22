import { memo, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import type { CrudColumn, CrudField } from "@/components/crud/CrudPage";
import { CrudPage } from "@/components/crud/CrudPage";
import { idInQuery, subtreeIds } from "@/components/crud/scope";
import { Button } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/overlay";
import { realmOrgApi } from "@/lib/api";
import type { AdmOrgVo, FormValues, PageQuery } from "@/lib/types";
import {
  optionKeys,
  useOrgOptions,
  useOrgTypeOptions,
  useRealmOptions,
  useRealmOrgBindings,
} from "@/lib/queries";
import { shortId } from "@/lib/utils";

function optionalText(value: FormValues[string]): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  // 空串显式传 null：ModifyDto 的 Option<String> 用 Some(None) 表达清空
  return text ? text : null;
}

/** 树层级：treeCode 每层 3 位，深度 0 为根。 */
function depthOf(treeCode: string): number {
  return Math.max(0, Math.floor(treeCode.length / 3) - 1);
}

/** 缩进只在「组织」列画一次，避免多列各写一份重复逻辑。 */
const OrgNameCell = memo(function OrgNameCell({ row }: { row: AdmOrgVo }) {
  const depth = depthOf(row.treeCode);
  return (
    <div className="flex min-w-0 flex-col">
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <span className="text-muted/50">{"·".repeat(depth)}</span>
        <span className="font-medium text-ink">{row.name}</span>
        <code className="font-mono text-[10.5px] text-muted">{row.treeCode}</code>
      </span>
      {row.fullName && (
        <span className="truncate text-[11px] text-muted" title={row.fullName}>
          {row.fullName}
        </span>
      )}
    </div>
  );
});

/**
 * 组织是全局一棵树（treeCode 全局唯一），与领域多对多：领域只决定「哪些组织属于该域」，
 * 不在组织表上存领域列。类型来自组织类型字典，成员关系在 org_user 上维护。
 */
export function OrgsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const orgsQuery = useOrgOptions();
  const orgs = orgsQuery.data ?? [];
  const orgTypesQuery = useOrgTypeOptions();
  const realmsQuery = useRealmOptions();
  const realms = realmsQuery.data ?? [];
  /** 领域 tab 只在领域数 > 1 时出现；选中态由页面持有，收窄条件折进 extraQuery。 */
  const [realmTab, setRealmTab] = useState<string | null>(null);
  const showRealmTabs = realms.length > 1;
  // 新建表单按领域收窄上级组织、保存后写 realm_org 绑定，所以无论 tab 是否显示都要加载。
  const realmOrgBindings = useRealmOrgBindings();
  const activeRealm = realmTab && realms.some((realm) => realm.id === realmTab) ? realmTab : null;

  /**
   * 选中领域 → 该领域绑定的组织及其全部子孙 → `id` 的 is_in 条件；未选领域不收窄。
   * 领域绑定的是子树根（与可见范围同一套语义），展开子孙才能在该 tab 下看到完整的组织树。
   */
  const extraQuery = useMemo<PageQuery>(() => {
    if (!activeRealm) return {};
    const boundIds = (realmOrgBindings.data ?? [])
      .filter((binding) => binding.realmId === activeRealm)
      .map((binding) => binding.orgId);
    const ids = new Set<string>();
    for (const orgId of boundIds) {
      for (const id of subtreeIds(orgs, orgId)) ids.add(id);
    }
    return idInQuery([...ids]);
  }, [activeRealm, realmOrgBindings.data, orgs]);

  const orgTypeName = useMemo(() => {
    const map = new Map<string, string>();
    for (const type of orgTypesQuery.data ?? []) map.set(type.id, type.name);
    return map;
  }, [orgTypesQuery.data]);

  /**
   * 上级组织下拉：只在新建时出现，所以不存在「选到自己」的问题；缩进按 treeCode 深度。
   * 选了领域后只列该领域绑定组织（含子孙）作为上级，避免把组织挂到别的领域树下；
   * 该领域还没有任何绑定时退回全量，否则新建第一个组织会无从下手。
   */
  const parentOptions = (values: FormValues) => {
    let candidates = orgsQuery.data ?? [];
    const realmId = String(values.realmId ?? "");
    if (realmId) {
      const boundIds = (realmOrgBindings.data ?? [])
        .filter((binding) => binding.realmId === realmId)
        .map((binding) => binding.orgId);
      if (boundIds.length > 0) {
        const allowed = new Set<string>();
        for (const orgId of boundIds) {
          for (const id of subtreeIds(candidates, orgId)) allowed.add(id);
        }
        candidates = candidates.filter((org) => allowed.has(org.id));
      }
    }
    return candidates.map((org) => ({
      value: org.treeCode,
      label: `${"　".repeat(depthOf(org.treeCode))}${org.name} · ${org.treeCode}`,
    }));
  };

  const columns: CrudColumn<AdmOrgVo>[] = [
    {
      key: "name",
      label: "组织",
      className: "whitespace-nowrap",
      render: (row) => <OrgNameCell row={row} />,
    },
    {
      key: "orgTypeId",
      label: "类型",
      className: "whitespace-nowrap",
      render: (row) =>
        row.orgTypeId ? (
          <span>{orgTypeName.get(row.orgTypeId) ?? shortId(row.orgTypeId)}</span>
        ) : (
          <span className="text-muted">未分类</span>
        ),
    },
    {
      key: "code",
      label: "编码",
      type: "code",
      truncate: true,
      truncateClassName: "max-w-[180px]",
    },
    { key: "remark", label: "备注", truncate: true },
    { key: "enabled", label: "启用", className: "whitespace-nowrap", toggle: {} },
  ];

  const fields: CrudField[] = [
    {
      name: "realmId",
      label: "领域",
      type: "select",
      createOnly: true,
      options: realms.map((realm) => ({ value: realm.id, label: realm.name })),
      hint: "领域决定这个组织归哪个数据域；保存后会建立领域↔组织绑定，上级组织也只列该领域的树。",
    },
    { name: "name", label: "名称", required: true, placeholder: "同一父节点下允许重名，靠 treeCode 区分" },
    {
      name: "parentCode",
      label: "上级组织",
      type: "select",
      createOnly: true,
      options: parentOptions,
      resetOn: ["realmId"],
      hint: "不选则创建根组织。treeCode 由服务端按上级生成、建好后不能再改上级——挂错层只能删掉重建（行内排序只调同级先后）。",
    },
    {
      name: "fullName",
      label: "全名",
      placeholder: "如 集团.分厂.车间",
      hint: "可选，便于按路径检索；填写后在列表里作为副标题展示。",
    },
    {
      name: "code",
      label: "编码",
      placeholder: "可选，对接外部系统的组织编号",
      hint: "全局唯一；留空表示纯内部组织。",
    },
    {
      name: "orgTypeId",
      label: "组织类型",
      type: "select",
      options: (orgTypesQuery.data ?? []).map((type) => ({ value: type.id, label: type.name })),
      hint: orgTypesQuery.data?.length
        ? "为空表示未分类。"
        : "还没有组织类型，可先到「组织类型」建一个。",
    },
    { name: "remark", label: "备注", type: "textarea" },
  ];

  const toForm = (row: AdmOrgVo): FormValues => ({
    parentCode: "",
    name: row.name,
    code: row.code ?? "",
    fullName: row.fullName ?? "",
    orgTypeId: row.orgTypeId ?? "",
    remark: row.remark ?? "",
  });

  const toPayload = (values: FormValues, mode: "create" | "edit") => {
    const base: Record<string, unknown> = {
      name: String(values.name ?? "").trim(),
      code: optionalText(values.code),
      fullName: optionalText(values.fullName),
      orgTypeId: optionalText(values.orgTypeId),
      remark: optionalText(values.remark),
    };
    if (mode === "create") base.parentCode = optionalText(values.parentCode);
    return base;
  };

  return (
    <CrudPage<AdmOrgVo>
      title="组织管理"
      subtitle="组织是全局一棵树：treeCode 表达层级，类型来自组织类型字典，与领域多对多（领域只决定「哪些组织属于我」）。领域多于一个时按顶部 tab 切换；树默认收起，分页按一级组织数量计。行内「添加子级」会预填上级组织。"
      prefix="/adm/org"
      columns={columns}
      fields={fields}
      itemLabel={(row) => row.name}
      defaultOrderBy="tree_code:asc"
      sortable={{ kind: "tree", treeCode: (row) => row.treeCode }}
      treeDefaultCollapsed
      paginateByRoot
      rootLabel="一级组织"
      extraQuery={extraQuery}
      tabs={
        showRealmTabs
          ? {
              ariaLabel: "领域",
              options: realms.map((realm) => ({ value: realm.id, label: realm.name })),
              selected: activeRealm,
              onSelect: setRealmTab,
            }
          : undefined
      }
      searchPlaceholder="搜索组织名 / 全名 / 编码 / 备注"
      filters={[
        {
          type: "entity",
          name: "org_type_id",
          label: "类型",
          options: (orgTypesQuery.data ?? []).map((type) => ({ value: type.id, label: type.name })),
        },
        { type: "boolean", name: "enabled", label: "启用" },
      ]}
      createLabel="新建组织"
      createDefaults={{ realmId: activeRealm ?? realms[0]?.id ?? "" }}
      afterCreate={async (values, created) => {
        const realmId = String(values.realmId ?? "");
        if (!realmId || !created?.id) return;
        try {
          await realmOrgApi.add({ realmId, orgId: created.id });
          await queryClient.invalidateQueries({ queryKey: optionKeys.realmOrg });
        } catch (error) {
          toast.error(
            `组织已创建，但登记到所选领域失败：${error instanceof Error ? error.message : "请稍后重试绑定"}`,
          );
        }
      }}
      emptyDescription="还没有组织。先建根组织，再用行内「添加子级」逐级建成分厂 / 部门。"
      rowActions={(row, { openCreate, canCreate }) =>
        canCreate ? (
          <Button
            size="sm"
            variant="ghost"
            title={`在「${row.name}」（${row.treeCode}）下新建子组织`}
            onClick={() => {
              const prefix = row.fullName ?? row.name;
              openCreate(
                { parentCode: row.treeCode, fullName: `${prefix}.` },
                `将在「${row.name}」· ${row.treeCode} 下创建子组织，上级组织已预填。`,
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
