import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { opTypeApi } from "@/lib/api";
import type { CrudColumn, CrudField } from "@/components/crud/CrudPage";
import { CrudPage } from "@/components/crud/CrudPage";
import { treeGroupQuery } from "@/components/crud/scope";
import type { AdmPermVo, FormValues } from "@/lib/types";
import { usePermGroupOptions } from "@/lib/queries";
import { PERM_SUBJECTS, subjectLabel, subjectTreeCode } from "@/lib/perm-subject";

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

  const groupById = useMemo(() => {
    const map = new Map<string, { name: string; treeCode: string }>();
    for (const group of groupsQuery.data ?? []) {
      map.set(group.id, { name: group.name, treeCode: group.treeCode });
    }
    return map;
  }, [groupsQuery.data]);

  const groupByTree = useMemo(() => {
    const map = new Map<string, { name: string; treeCode: string }>();
    for (const group of groupsQuery.data ?? []) {
      map.set(group.treeCode, { name: group.name, treeCode: group.treeCode });
    }
    return map;
  }, [groupsQuery.data]);

  const opTypeName = useMemo(() => {
    const map = new Map<string, string>();
    for (const opType of opTypesQuery.data ?? []) map.set(opType.code, opType.name);
    return map;
  }, [opTypesQuery.data]);

  /**
   * 分组的第三层就是主体：拿它校验「主体」与「权限分组」是否自洽，
   * 顺手拦住「把用户权限挂到组织分组下」这类手工录入错误。
   */
  const subjectOfGroup = (groupId: string | undefined) => {
    const group = groupId ? groupById.get(groupId) : undefined;
    if (!group) return undefined;
    const subjectGroup = groupByTree.get(subjectTreeCode(group.treeCode));
    if (!subjectGroup) return undefined;
    return PERM_SUBJECTS.find((item) => item.label === subjectGroup.name);
  };

  /** 选中父分组时连同全局分组树中的子孙分组一起展示。 */
  const groupQueryFor = (groupId: string) =>
    treeGroupQuery("group_id", groupId, groupsQuery.data ?? []);

  const columns: CrudColumn<AdmPermVo>[] = [
    {
      key: "name",
      label: "权限",
      className: "whitespace-nowrap",
      render: (row) => <span className="font-medium text-ink">{row.name}</span>,
    },
    {
      key: "subjectCode",
      label: "主体",
      className: "whitespace-nowrap",
      render: (row) => (
        <span title={`${subjectLabel(row.subjectCode)}（${row.subjectCode}）`}>
          {subjectLabel(row.subjectCode)}
        </span>
      ),
    },
    {
      key: "opTypeCode",
      label: "类型",
      className: "whitespace-nowrap",
      render: (row) => {
        const name = opTypeName.get(row.opTypeCode);
        return (
          <span title={`${name ?? row.opTypeCode}（${row.opTypeCode}）`}>
            {name ?? row.opTypeCode}
          </span>
        );
      },
    },
    {
      key: "urn",
      label: "URN",
      className: "whitespace-nowrap",
      render: (row) => <code className="font-mono text-[11.5px] text-accent-strong">{row.urn}</code>,
    },
    { key: "enabled", label: "启用", className: "whitespace-nowrap", toggle: {} },
  ];

  const fields: CrudField[] = [
    {
      name: "groupId",
      label: "权限分组",
      type: "select",
      required: true,
      options: (groupsQuery.data ?? []).map((group) => ({
        value: group.id,
        label: `${"　".repeat(Math.max(0, group.treeCode.length / 3 - 1))}${group.name} · ${group.treeCode}`,
      })),
      hint: groupsQuery.data?.length
        ? "按「菜单一级 / 主体 / 类型」四层选择，末层才挂权限；权限名在同一分组内唯一。"
        : "还没有权限分组，请先到「权限分组」创建。",
    },
    { name: "name", label: "名称", required: true, placeholder: "只写动作，如「按 ID 删除」，1-50 字" },
    {
      name: "subjectCode",
      label: "主体",
      type: "select",
      required: true,
      options: PERM_SUBJECTS.map((item) => ({
        value: item.value,
        label: `${item.section} / ${item.label}`,
      })),
      hint: "权限作用的业务对象，必须与所选分组的第三层一致；名称里不再重复写主体。",
      validate: (value, values) => {
        const expected = subjectOfGroup(String(values.groupId ?? ""));
        const actual = String(value ?? "").trim();
        if (!expected || !actual) return null;
        return actual === expected.value
          ? null
          : `该分组属于「${expected.label}」，主体请选 ${expected.label}（${expected.value}）`;
      },
    },
    {
      name: "opTypeCode",
      label: "类型",
      type: "select",
      required: true,
      options: (opTypesQuery.data ?? []).map((opType) => ({
        value: opType.code,
        label: `${opType.name}（${opType.code}）`,
      })),
      hint: "必填；取值受 op_type 字典限制。分组的第四层同样是类型，两者应保持一致。",
    },
    {
      name: "urn",
      label: "URN",
      required: true,
      placeholder: "METHOD:路径，如 GET:/adm/user/page",
      hint: "全局唯一，鉴权时按前缀匹配；创建后不要改。",
    },
    { name: "remark", label: "备注", type: "textarea" },
  ];

  const toForm = (row: AdmPermVo): FormValues => ({
    groupId: row.groupId,
    name: row.name,
    subjectCode: row.subjectCode,
    opTypeCode: row.opTypeCode,
    urn: row.urn,
    remark: row.remark ?? "",
  });

  const toPayload = (values: FormValues) => ({
    groupId: values.groupId,
    name: String(values.name ?? "").trim(),
    subjectCode: String(values.subjectCode ?? "").trim(),
    opTypeCode: String(values.opTypeCode ?? "").trim(),
    urn: String(values.urn ?? "").trim(),
    remark: optionalText(values.remark),
  });

  return (
    <CrudPage<AdmPermVo>
      title="权限管理"
      subtitle="权限点按「主体 + 操作类型」归类：名称只写动作，主体用 subject_code 记录作用对象，URN 表达「HTTP 方法 + 路径」。左侧按分组树切换，选中父分组会连同子分组一起展示；后端当前只校验 Bearer 身份，接口级 URN 授权后续在 gatex-rs 实现。"
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
        hint: "选中分组后只列该分组（含子分组）的权限，新建时自动归入该分组；最末层（类型）才是权限的归属分组。",
      }}
      filters={[
        {
          type: "select",
          name: "subject_code",
          label: "主体",
          options: PERM_SUBJECTS.map((item) => ({
            value: item.value,
            label: `${item.section} / ${item.label}`,
          })),
        },
        { type: "boolean", name: "enabled", label: "启用" },
      ]}
      emptyDescription="该分组下还没有权限行。先到「权限分组」建好分组，再按接口逐个录入 URN。"
      toForm={toForm}
      toPayload={toPayload}
    />
  );
}
