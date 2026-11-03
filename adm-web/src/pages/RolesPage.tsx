import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  menuApi,
  permApi,
  roleApi,
  roleGroupApi,
  roleMenuApi,
  rolePermApi,
} from "@/lib/api";
import type { CrudColumn, CrudField } from "@/components/crud/CrudPage";
import { CrudPage } from "@/components/crud/CrudPage";
import { MenuCheckList, PermCheckList } from "@/components/crud/tree";
import { Button, Spinner } from "@/components/ui/primitives";
import { Drawer, useToast } from "@/components/ui/overlay";
import type { AdmRoleVo, FormValues } from "@/lib/types";
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
  const permsQuery = useQuery({
    queryKey: ["perm", "all-for-role"],
    queryFn: () => permApi.list({ _orderBy: "sort_order:asc" }),
    enabled: open,
  });
  const menusQuery = useQuery({
    queryKey: ["menu", "all-for-role"],
    queryFn: () => menuApi.list({ _orderBy: "tree_code:asc" }),
    enabled: open,
  });

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
      onSaved();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存授权失败");
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
      description="关系写入 /adm/role-perm 与 /adm/role-menu；保存时只提交差异。"
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
            />
          ) : (
            <MenuCheckList
              menus={menusQuery.data ?? []}
              selected={selectedMenus}
              onToggle={(id) => toggle(setSelectedMenus, id)}
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

  const groupsQuery = useQuery({
    queryKey: ["roleGroup", "options"],
    queryFn: () => roleGroupApi.list({ _orderBy: "tree_code:asc" }),
    staleTime: 30_000,
  });

  const groupName = useMemo(() => {
    const map = new Map<string, string>();
    for (const group of groupsQuery.data ?? []) map.set(group.id, group.name);
    return map;
  }, [groupsQuery.data]);

  const columns: CrudColumn<AdmRoleVo>[] = [
    { key: "name", label: "角色", render: (row) => <span className="font-medium text-ink">{row.name}</span> },
    { key: "groupId", label: "角色分组", render: (row) => groupName.get(row.groupId) ?? `#${row.groupId}` },
    { key: "enabled", label: "启用", type: "boolean", booleanLabels: { on: "启用", off: "停用" } },
    { key: "remark", label: "备注" },
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
    { name: "enabled", label: "启用", type: "switch", defaultValue: true },
    { name: "remark", label: "备注", type: "textarea", placeholder: "0-50 字" },
  ];

  const toForm = (row: AdmRoleVo): FormValues => ({
    groupId: row.groupId,
    name: row.name,
    enabled: row.enabled,
    remark: row.remark ?? "",
  });

  const toPayload = (values: FormValues) => ({
    groupId: values.groupId,
    name: String(values.name ?? "").trim(),
    enabled: Boolean(values.enabled),
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
        subtitle="角色是权限与菜单的集合。角色本身不决定菜单，授权后由角色 × 用户关系生效。"
        prefix="/adm/role"
        columns={columns}
        fields={fields}
        itemLabel={(row) => row.name}
        defaultOrderBy="sort_order:asc"
        sortable={{ kind: "number", orderValue: (row) => row.sortOrder, scope: (row) => row.groupId }}
        searchPlaceholder="搜索角色名 / 备注"
        filters={[
          {
            type: "select",
            name: "group_id",
            label: "角色分组",
            options: (groupsQuery.data ?? []).map((group) => ({ value: group.id, label: group.name })),
          },
          { type: "boolean", name: "enabled", label: "启用" },
        ]}
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
