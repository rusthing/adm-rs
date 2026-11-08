import { useMemo } from "react";
import { Plus } from "lucide-react";
import type { CrudColumn, CrudField } from "@/components/crud/CrudPage";
import { CrudPage } from "@/components/crud/CrudPage";
import { PAGE_COMPONENTS } from "@/pages/registry";
import { ICON_NAMES } from "@/components/layout/nav";
import { Badge, Button } from "@/components/ui/primitives";
import type { AdmMenuVo, FormValues } from "@/lib/types";
import { useAppOptions, useMenuOptions } from "@/lib/queries";
import { shortId } from "@/lib/utils";

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
  const appsQuery = useAppOptions();
  const menusQuery = useMenuOptions();

  const appName = useMemo(() => {
    const map = new Map<string, string>();
    for (const app of appsQuery.data ?? []) map.set(app.id, app.name);
    return map;
  }, [appsQuery.data]);

  /**
   * 父节点下拉按表单里当前 appId 过滤：treeCode 只在应用内唯一，
   * 跨应用选父节点一定会被后端拒绝，没必要让用户选得到。
   */
  const parentOptions = (values: FormValues) => {
    const appId = String(values.appId ?? "");
    return (menusQuery.data ?? [])
      .filter((menu) => !appId || menu.appId === appId)
      .map((menu) => ({
        value: menu.treeCode,
        label: `${"　".repeat(Math.max(0, menu.treeCode.length / 3 - 1))}${menu.name} · ${menu.treeCode}`,
      }));
  };

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
    {
      key: "appId",
      label: "应用",
      render: (row) => appName.get(row.appId) ?? shortId(row.appId),
    },
    { key: "code", label: "编码", type: "code" },
    { key: "path", label: "路径", type: "code", truncate: true },
    {
      key: "linkType",
      label: "类型",
      render: (row) => {
        const type = LINK_TYPE[row.linkType] ?? { label: `类型 ${row.linkType}`, tone: "info" as const };
        return <Badge tone={type.tone}>{type.label}</Badge>;
      },
    },
    { key: "visible", label: "显示", toggle: { labels: { on: "显示", off: "隐藏" } } },
    { key: "enabled", label: "启用", toggle: {} },
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
      resetOn: ["appId"],
      hint: "只列出同一应用下的菜单；不选则创建根节点，treeCode 由服务端生成。",
    },
    { name: "code", label: "编码", required: true, placeholder: "同一应用内唯一，如 system:user" },
    { name: "name", label: "名称", required: true, placeholder: "同一应用内唯一" },
    { name: "path", label: "路径", required: true, placeholder: "内链以 / 开头；外链/iframe 填完整 URL" },
    {
      name: "component",
      label: "页面组件",
      type: "select",
      options: Object.keys(PAGE_COMPONENTS).map((key) => ({ value: key, label: key })),
      hint: "留空表示目录节点。只能选当前前端已登记的页面，未登记的组件不会出现在侧栏。",
    },
    {
      name: "linkType",
      label: "链接类型",
      type: "select",
      required: true,
      fixedOptions: true,
      defaultValue: "1",
      options: [
        { value: "1", label: "1 · 内链" },
        { value: "2", label: "2 · 外链" },
        { value: "3", label: "3 · iframe" },
      ],
      validate: (_value, values) => {
        const path = String(values.path ?? "").trim();
        const type = Number(values.linkType ?? 1);
        if (!path) return null;
        if (type === 1 && !path.startsWith("/")) return "内链路径需以 / 开头";
        if (type !== 1 && !/^https?:\/\//i.test(path)) return "外链 / iframe 需填写完整 URL（http(s)://…）";
        return null;
      },
    },
    {
      name: "icon",
      label: "图标",
      type: "select",
      options: ICON_NAMES.map((name) => ({ value: name, label: name })),
      hint: "从当前前端图标表里选择；留空则用默认图标。",
    },
    { name: "keepAlive", label: "缓存页面", type: "switch", defaultValue: false },
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
      subtitle="菜单树按应用隔离，用 treeCode（每层 3 位）表达层级。左侧按应用切换，行内「添加子级」会预填所属应用与父节点；treeCode 由服务端生成，未登记组件的菜单不会出现在侧栏。"
      prefix="/adm/menu"
      columns={columns}
      fields={fields}
      itemLabel={(row) => row.name}
      defaultOrderBy="tree_code:asc"
      sortable={{ kind: "tree", treeCode: (row) => row.treeCode, scope: (row) => row.appId }}
      searchPlaceholder="搜索菜单名 / 编码 / 路径"
      scope={{
        title: "应用",
        param: "app_id",
        field: "appId",
        options: (appsQuery.data ?? []).map((app) => ({
          value: app.id,
          label: app.name,
          description: app.code,
          disabled: !app.enabled,
        })),
        loading: appsQuery.isLoading,
        emptyText: "还没有应用，请先到「应用管理」创建，再回来建菜单。",
        hint: "菜单树按应用隔离；两个及以上应用时才显示此分组栏，选中后新建会自动填入该应用。",
      }}
      filters={[
        { type: "boolean", name: "visible", label: "显示" },
        { type: "boolean", name: "enabled", label: "启用" },
      ]}
      createLabel="新建菜单"
      emptyDescription="该应用下还没有菜单行；先建根菜单，再用行内「添加子级」逐级补齐。"
      rowActions={(row, { openCreate, setScope, canCreate }) =>
        canCreate ? (
          <Button
            size="sm"
            variant="ghost"
            title={`在「${row.name}」（${row.treeCode}）下新建子菜单`}
            onClick={() => {
              // 先切到父节点所属应用：否则新子节点会因为列表仍停在别的应用而「消失」。
              setScope(row.appId);
              openCreate(
                { appId: row.appId, parentCode: row.treeCode },
                `将在「${row.name}」· ${row.treeCode} 下创建子菜单，所属应用与父节点已预填。`,
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
