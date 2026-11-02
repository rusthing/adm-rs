import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { appApi, menuApi } from "@/lib/api";
import type { CrudColumn, CrudField } from "@/components/crud/CrudPage";
import { CrudPage } from "@/components/crud/CrudPage";
import { Badge } from "@/components/ui/primitives";
import type { AdmMenuVo, FormValues } from "@/lib/types";

const LINK_TYPE: Record<number, { label: string; tone: "info" | "warn" | "violet" }> = {
  1: { label: "内链", tone: "info" },
  2: { label: "外链", tone: "warn" },
  3: { label: "iframe", tone: "violet" },
};

function optionalText(value: FormValues[string]): string | undefined {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text : undefined;
}

export function MenusPage() {
  const appsQuery = useQuery({
    queryKey: ["app", "options"],
    queryFn: () => appApi.list({ _orderBy: "sort_order:asc" }),
    staleTime: 30_000,
  });
  const menusQuery = useQuery({
    queryKey: ["menu", "options"],
    queryFn: () => menuApi.list({ _orderBy: "tree_code:asc" }),
    staleTime: 30_000,
  });

  const appName = useMemo(() => {
    const map = new Map<string, string>();
    for (const app of appsQuery.data ?? []) map.set(app.id, app.name);
    return map;
  }, [appsQuery.data]);

  const parentOptions = useMemo(
    () =>
      (menusQuery.data ?? []).map((menu) => ({
        value: menu.treeCode,
        label: `${"　".repeat(Math.max(0, menu.treeCode.length / 3 - 1))}${menu.name} · ${menu.treeCode}`,
      })),
    [menusQuery.data],
  );

  const columns: CrudColumn<AdmMenuVo>[] = [
    {
      key: "name",
      label: "菜单",
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
    { key: "appId", label: "应用", render: (row) => appName.get(row.appId) ?? `#${row.appId}` },
    { key: "code", label: "编码", render: (row) => <code className="font-mono text-[11.5px] text-ink-soft">{row.code}</code> },
    { key: "path", label: "路径", render: (row) => <code className="font-mono text-[11.5px] text-muted">{row.path}</code> },
    {
      key: "linkType",
      label: "类型",
      render: (row) => {
        const type = LINK_TYPE[row.linkType] ?? { label: `类型 ${row.linkType}`, tone: "info" as const };
        return <Badge tone={type.tone}>{type.label}</Badge>;
      },
    },
    {
      key: "visible",
      label: "显示",
      render: (row) => (
        <div className="flex items-center gap-1">
          <Badge tone={row.visible ? "success" : "neutral"}>{row.visible ? "显示" : "隐藏"}</Badge>
          {!row.enabled && <Badge tone="warn">停用</Badge>}
        </div>
      ),
    },
  ];

  const fields: CrudField[] = [
    {
      name: "appId",
      label: "所属应用",
      type: "select",
      required: true,
      createOnly: true,
      options: (appsQuery.data ?? []).map((app) => ({ value: app.id, label: `${app.name}（${app.code}）` })),
      hint: appsQuery.data?.length ? "treeCode 只在应用内唯一。" : "还没有应用，请先到「应用管理」创建。",
    },
    {
      name: "parentCode",
      label: "父节点",
      type: "select",
      createOnly: true,
      options: parentOptions,
      hint: "不选则创建根节点。服务端根据 parentCode 生成 treeCode；留空即根节点。",
    },
    { name: "code", label: "编码", required: true, placeholder: "同一应用内唯一，如 system:user" },
    { name: "name", label: "名称", required: true, placeholder: "同一应用内唯一" },
    { name: "path", label: "路径", required: true, placeholder: "内链以 / 开头；外链/iframe 填完整 URL" },
    { name: "component", label: "组件路径", placeholder: "为空表示目录节点", hint: "前端按 component 映射页面组件；未登记的 component 会降级为占位页。" },
    {
      name: "linkType",
      label: "链接类型",
      type: "select",
      required: true,
      defaultValue: "1",
      options: [
        { value: "1", label: "1 · 内链" },
        { value: "2", label: "2 · 外链" },
        { value: "3", label: "3 · iframe" },
      ],
    },
    { name: "icon", label: "图标", placeholder: "前端图标名，如 SettingOutlined" },
    { name: "keepAlive", label: "缓存页面", type: "switch", defaultValue: false },
    { name: "visible", label: "在导航中显示", type: "switch", defaultValue: true },
    { name: "enabled", label: "启用", type: "switch", defaultValue: true },
    { name: "remark", label: "备注", type: "textarea" },
  ];

  const toForm = (row: AdmMenuVo): FormValues => ({
    appId: row.appId,
    parentCode: "",
    code: row.code,
    name: row.name,
    path: row.path,
    component: row.component ?? "",
    linkType: String(row.linkType ?? 1),
    icon: row.icon ?? "",
    keepAlive: row.keepAlive,
    visible: row.visible,
    enabled: row.enabled,
    remark: row.remark ?? "",
  });

  const toPayload = (values: FormValues, mode: "create" | "edit") => {
    const base: Record<string, unknown> = {
      code: String(values.code ?? "").trim(),
      name: String(values.name ?? "").trim(),
      path: String(values.path ?? "").trim(),
      component: optionalText(values.component),
      linkType: Number(values.linkType ?? 1),
      icon: optionalText(values.icon),
      keepAlive: Boolean(values.keepAlive),
      visible: Boolean(values.visible),
      enabled: Boolean(values.enabled),
      remark: optionalText(values.remark),
    };
    if (mode === "create") {
      base.appId = values.appId;
      base.parentCode = optionalText(values.parentCode);
    }
    return base;
  };

  return (
    <CrudPage<AdmMenuVo>
      title="菜单管理"
      subtitle="菜单树用 treeCode（每层 3 位）表达；新增时传 parentCode，treeCode 由服务端生成。本前端不消费该数据生成路由，仅作为管理数据。"
      prefix="/adm/menu"
      columns={columns}
      fields={fields}
      itemLabel={(row) => row.name}
      defaultOrderBy="tree_code:asc"
      searchPlaceholder="搜索菜单名 / 编码 / 路径"
      createLabel="新建菜单"
      emptyDescription="后端种子没有菜单行；先建应用，再建根菜单，最后建子菜单。"
      toForm={toForm}
      toPayload={toPayload}
    />
  );
}
