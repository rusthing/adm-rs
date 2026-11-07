import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { roleApi, roleMenuApi, rolePermApi } from "@/lib/api";
import type { CrudColumn, CrudField } from "@/components/crud/CrudPage";
import { CrudPage } from "@/components/crud/CrudPage";
import { MenuCheckList, PermCheckList } from "@/components/crud/tree";
import { treeGroupQuery } from "@/components/crud/scope";
import { Button, Spinner } from "@/components/ui/primitives";
import { Drawer, useToast } from "@/components/ui/overlay";
import { useAuth } from "@/auth/AuthContext";
import type { AdmRoleVo, FormValues } from "@/lib/types";
import { useMenuOptions, usePermOptions, useRoleGroupOptions } from "@/lib/queries";
import { shortId } from "@/lib/utils";
import { LockKeyhole, Menu as MenuIcon, ShieldCheck } from "lucide-react";

function optionalText(value: FormValues[string]): string | undefined {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text : undefined;
}

function RoleGrantsDrawer({
  role,
  onClose,
  onSaved,
}: {
  role: AdmRoleVo | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const open = Boolean(role);
  const toast = useToast();
  const queryClient = useQueryClient();
  const { refreshAuthz } = useAuth();
  const [tab, setTab] = useState<"perm" | "menu">("perm");
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set());
  const [selectedMenus, setSelectedMenus] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const permBindingsQuery = useQuery({
    queryKey: ["role-perm", "by-role", role?.id],
    queryFn: () => rolePermApi.list({ roleId: role!.id }),
    enabled: open,
  });
  const menuBindingsQuery = useQuery({
    queryKey: ["role-menu", "by-role", role?.id],
    queryFn: () => roleMenuApi.list({ roleId: role!.id }),
    enabled: open,
  });
  const permsQuery = usePermOptions(open);
  const menusQuery = useMenuOptions(open);

  // 切换角色时清空勾选，避免绑定尚未返回时沿用上一个角色的选中状态。
  useEffect(() => {
    setSelectedPerms(new Set());
    setSelectedMenus(new Set());
  }, [role?.id]);

  useEffect(() => {
    if (!permBindingsQuery.data) return;
    setSelectedPerms(new Set(permBindingsQuery.data.map((binding) => binding.permId)));
  }, [permBindingsQuery.data]);

  useEffect(() => {
    if (!menuBindingsQuery.data) return;
    setSelectedMenus(new Set(menuBindingsQuery.data.map((binding) => binding.menuId)));
  }, [menuBindingsQuery.data]);

  const toggle = (setter: typeof setSelectedPerms, id: string) => {
    setter((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /** 按分组批量勾选 / 清空；一次改一批，避免逐条 setState。 */
  const setMany = (setter: typeof setSelectedPerms, ids: string[], checked: boolean) => {
    setter((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  const save = async () => {
    if (!role) return;
    setSaving(true);
    try {
      const permBindings = permBindingsQuery.data ?? [];
      const menuBindings = menuBindingsQuery.data ?? [];

      const permOriginal = new Set(permBindings.map((binding) => binding.permId));
      const menuOriginal = new Set(menuBindings.map((binding) => binding.menuId));

      const addPerms = [...selectedPerms].filter((id) => !permOriginal.has(id));
      const delPerms = permBindings.filter((binding) => !selectedPerms.has(binding.permId));
      const addMenus = [...selectedMenus].filter((id) => !menuOriginal.has(id));
      const delMenus = menuBindings.filter((binding) => !selectedMenus.has(binding.menuId));

      await Promise.all([
        ...addPerms.map((permId) => rolePermApi.add({ roleId: role.id, permId })),
        ...delPerms.map((binding) => rolePermApi.remove(binding.id)),
        ...addMenus.map((menuId) => roleMenuApi.add({ roleId: role.id, menuId })),
        ...delMenus.map((binding) => roleMenuApi.remove(binding.id)),
      ]);
      toast.success(`已更新「${role.name}」的授权`);
      await queryClient.invalidateQueries({ queryKey: ["role-perm"] });
      await queryClient.invalidateQueries({ queryKey: ["role-menu"] });
      // 授权会影响当前用户可见菜单与首页，首页缓存一并失效。
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      // 改的可能正是当前账号所属角色：重新拉一次权限视图，侧栏与页面门禁立即生效，
      // 不必等下次刷新页面。
      await refreshAuthz();
      onSaved();
      onClose();
    } catch (error) {
      // 差异逐条提交，可能部分成功；重新读取绑定让界面回到服务端真实状态。
      await Promise.all([permBindingsQuery.refetch(), menuBindingsQuery.refetch()]);
      toast.error(error instanceof Error ? error.message : "保存授权失败，已重新读取当前绑定");
    } finally {
      setSaving(false);
    }
  };

  const loading =
    permBindingsQuery.isLoading || menuBindingsQuery.isLoading || permsQuery.isLoading || menusQuery.isLoading;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`角色授权 · ${role?.name ?? ""}`}
      description="保存时只提交新增与移除的差异；授权变更对所属账号立即生效。"
      width="w-full max-w-[720px]"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            取消
          </Button>
          <Button variant="primary" onClick={() => void save()} disabled={saving || loading}>
            {saving ? "保存中…" : `保存（${selectedPerms.size} 权限 / ${selectedMenus.size} 菜单）`}
          </Button>
        </>
      }
    >
      {loading ? (
        <Spinner />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-1 rounded-lg border border-line bg-sunken p-1">
            <button
              type="button"
              onClick={() => setTab("perm")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium ${
                tab === "perm" ? "bg-surface text-ink shadow-panel" : "text-muted hover:text-ink"
              }`}
            >
              <LockKeyhole size={13} /> 权限点 ({selectedPerms.size})
            </button>
            <button
              type="button"
              onClick={() => setTab("menu")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium ${
                tab === "menu" ? "bg-surface text-ink shadow-panel" : "text-muted hover:text-ink"
              }`}
            >
              <MenuIcon size={13} /> 菜单 ({selectedMenus.size})
            </button>
          </div>

          {tab === "perm" ? (
            <PermCheckList
              perms={permsQuery.data ?? []}
              selected={selectedPerms}
              onToggle={(id) => toggle(setSelectedPerms, id)}
              onSetMany={(ids, checked) => setMany(setSelectedPerms, ids, checked)}
            />
          ) : (
            <MenuCheckList
              menus={menusQuery.data ?? []}
              selected={selectedMenus}
              onToggle={(id) => toggle(setSelectedMenus, id)}
              onSetMany={(ids, checked) => setMany(setSelectedMenus, ids, checked)}
            />
          )}
        </div>
      )}
    </Drawer>
  );
}

export function RolesPage() {
  const toast = useToast();
  const [grantRole, setGrantRole] = useState<AdmRoleVo | null>(null);
  const queryClient = useQueryClient();

  const groupsQuery = useRoleGroupOptions();

  const groupName = useMemo(() => {
    const map = new Map<string, string>();
    for (const group of groupsQuery.data ?? []) map.set(group.id, group.name);
    return map;
  }, [groupsQuery.data]);

  const columns: CrudColumn<AdmRoleVo>[] = [
    { key: "name", label: "角色", render: (row) => <span className="font-medium text-ink">{row.name}</span> },
    {
      key: "groupId",
      label: "角色分组",
      render: (row) => groupName.get(row.groupId) ?? shortId(row.groupId),
    },
    { key: "enabled", label: "启用", toggle: {} },
    { key: "remark", label: "备注", truncate: true },
  ];

  const fields: CrudField[] = [
    {
      name: "groupId",
      label: "角色分组",
      type: "select",
      required: true,
      options: (groupsQuery.data ?? []).map((group) => ({ value: group.id, label: `${group.name}（${group.treeCode}）` })),
      hint: groupsQuery.data?.length ? "角色按分组唯一（groupId + name）。" : "还没有角色分组，请先到「角色分组」创建。",
    },
    { name: "name", label: "名称", required: true, placeholder: "同一分组内唯一，1-50 字" },
    { name: "remark", label: "备注", type: "textarea", placeholder: "0-50 字" },
  ];

  const toForm = (row: AdmRoleVo): FormValues => ({
    groupId: row.groupId,
    name: row.name,
    remark: row.remark ?? "",
  });

  const toPayload = (values: FormValues) => ({
    groupId: values.groupId,
    name: String(values.name ?? "").trim(),
    remark: optionalText(values.remark),
  });

  const openGrants = async (row: AdmRoleVo) => {
    try {
      const detail = await roleApi.get(row.id);
      setGrantRole(detail ?? row);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "读取角色详情失败");
    }
  };

  return (
    <>
      <CrudPage<AdmRoleVo>
        title="角色管理"
        subtitle="角色是权限与菜单的集合，按分组树组织。左侧按分组切换（含子分组），授权后由角色 × 用户关系生效。"
        prefix="/adm/role"
        columns={columns}
        fields={fields}
        itemLabel={(row) => row.name}
        defaultOrderBy="sort_order:asc"
        sortable={{ kind: "number", orderValue: (row) => row.sortOrder, scope: (row) => row.groupId }}
        searchPlaceholder="搜索角色名 / 备注"
        scope={{
          title: "角色分组",
          param: "group_id",
          field: "groupId",
          options: (groupsQuery.data ?? []).map((group) => ({
            value: group.id,
            label: group.name,
            treeCode: group.treeCode,
            description: group.treeCode,
            disabled: !group.enabled,
          })),
          queryFor: (groupId) => treeGroupQuery("group_id", groupId, groupsQuery.data ?? []),
          loading: groupsQuery.isLoading,
          emptyText: "还没有角色分组，请先到「角色分组」创建。",
          hint: "选中分组后只列该分组（含子分组）的角色，新建时自动归入该分组。",
        }}
        filters={[{ type: "boolean", name: "enabled", label: "启用" }]}
        toForm={toForm}
        toPayload={toPayload}
        rowActions={(row) => (
          <Button size="sm" variant="ghost" onClick={() => void openGrants(row)}>
            <ShieldCheck size={13} /> 授权
          </Button>
        )}
      />

      <RoleGrantsDrawer
        role={grantRole}
        onClose={() => setGrantRole(null)}
        onSaved={() => void queryClient.invalidateQueries({ queryKey: ["role"] })}
      />
    </>
  );
}
