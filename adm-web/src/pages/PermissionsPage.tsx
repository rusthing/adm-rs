import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { opTypeApi } from "@/lib/api";
import type { CrudColumn, CrudField } from "@/components/crud/CrudPage";
import { CrudPage } from "@/components/crud/CrudPage";
import { treeGroupQuery } from "@/components/crud/scope";
import type { AdmPermVo, FormValues } from "@/lib/types";
import { usePermGroupOptions } from "@/lib/queries";
import { shortId } from "@/lib/utils";

function optionalText(value: FormValues[string]): string | undefined {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text : undefined;
}

export function PermissionsPage() {
  const groupsQuery = usePermGroupOptions();
  const opTypesQuery = useQuery({
    queryKey: ["opType", "options"],
    queryFn: () => opTypeApi.list({ _orderBy: "sort_order:asc" }),
    staleTime: 30_000,
  });

  const groupName = useMemo(() => {
    const map = new Map<string, string>();
    for (const group of groupsQuery.data ?? []) map.set(group.id, group.name);
    return map;
  }, [groupsQuery.data]);

  /** 选中父分组时连同全局分组树中的子孙分组一起展示。 */
  const groupQueryFor = (groupId: string) =>
    treeGroupQuery("group_id", groupId, groupsQuery.data ?? []);

  const columns: CrudColumn<AdmPermVo>[] = [
    { key: "name", label: "权限", render: (row) => <span className="font-medium text-ink">{row.name}</span> },
    { key: "urn", label: "URN", render: (row) => <code className="font-mono text-[11.5px] text-accent-strong">{row.urn}</code> },
    {
      key: "groupId",
      label: "权限分组",
      render: (row) => groupName.get(row.groupId) ?? shortId(row.groupId),
    },
    { key: "opTypeCode", label: "操作类型", type: "code" },
    { key: "enabled", label: "启用", type: "boolean", booleanLabels: { on: "启用", off: "停用" } },
  ];

  const fields: CrudField[] = [
    {
      name: "groupId",
      label: "权限分组",
      type: "select",
      required: true,
      options: (groupsQuery.data ?? []).map((group) => ({ value: group.id, label: `${group.name}（${group.treeCode}）` })),
      hint: groupsQuery.data?.length ? "权限按分组唯一（groupId + name）。" : "还没有权限分组，请先到「权限分组」创建。",
    },
    { name: "name", label: "名称", required: true, placeholder: "同一分组内唯一，1-50 字" },
    { name: "urn", label: "URN", required: true, placeholder: "METHOD:路径，如 GET:/adm/user/page", hint: "全局唯一，鉴权时按前缀匹配；创建后不要改。" },
    {
      name: "opTypeCode",
      label: "操作类型",
      type: "select",
      options: (opTypesQuery.data ?? []).map((opType) => ({ value: opType.code, label: `${opType.name}（${opType.code}）` })),
      hint: "可留空；表示该权限与操作类型无关（如整页访问）。",
    },
    { name: "enabled", label: "启用", type: "switch", defaultValue: true },
    { name: "remark", label: "备注", type: "textarea" },
  ];

  const toForm = (row: AdmPermVo): FormValues => ({
    groupId: row.groupId,
    name: row.name,
    urn: row.urn,
    opTypeCode: row.opTypeCode ?? "",
    enabled: row.enabled,
    remark: row.remark ?? "",
  });

  const toPayload = (values: FormValues) => ({
    groupId: values.groupId,
    name: String(values.name ?? "").trim(),
    urn: String(values.urn ?? "").trim(),
    opTypeCode: optionalText(values.opTypeCode),
    enabled: Boolean(values.enabled),
    remark: optionalText(values.remark),
  });

  return (
    <CrudPage<AdmPermVo>
      title="权限管理"
      subtitle="权限点按分组组织，用「HTTP 方法 + 路径」的 URN 表达。左侧按分组树切换，选中父分组会连同子分组一起展示；后端当前只校验 Bearer 身份，接口级 URN 授权后续在 gatex-rs 实现。"
      prefix="/adm/perm"
      columns={columns}
      fields={fields}
      itemLabel={(row) => row.name}
      defaultOrderBy="sort_order:asc"
      sortable={{ kind: "number", orderValue: (row) => row.sortOrder, scope: (row) => row.groupId }}
      searchPlaceholder="搜索权限名 / URN / 备注"
      scope={{
        title: "权限分组",
        param: "group_id",
        field: "groupId",
        options: (groupsQuery.data ?? []).map((group) => ({
          value: group.id,
          label: group.name,
          treeCode: group.treeCode,
          description: group.treeCode,
          disabled: !group.enabled,
        })),
        queryFor: groupQueryFor,
        loading: groupsQuery.isLoading,
        emptyText: "还没有权限分组，请先到「权限分组」创建，再回来录入权限点。",
        hint: "选中分组后只列该分组（含子分组）的权限，新建时自动归入该分组。",
      }}
      filters={[{ type: "boolean", name: "enabled", label: "启用" }]}
      emptyDescription="该分组下还没有权限行。先到「权限分组」建好分组，再按接口逐个录入 URN。"
      toForm={toForm}
      toPayload={toPayload}
    />
  );
}
