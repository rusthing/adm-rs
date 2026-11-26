import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { roleApi, roleMenuApi, rolePermApi } from "@/lib/api";
import type { CrudColumn, CrudField } from "@/components/crud/CrudPage";
import { CrudPage } from "@/components/crud/CrudPage";
import { LinkedGroupSelector } from "@/components/crud/linked-group";
import { LinkedMenuSelector } from "@/components/crud/linked-menu";
import { treeGroupQuery } from "@/components/crud/scope";
import { Badge, Button, Spinner } from "@/components/ui/primitives";
import { Drawer, useToast } from "@/components/ui/overlay";
import { useAuth } from "@/auth/AuthContext";
import type { AdmRoleVo, FormValues } from "@/lib/types";
import {
  useAppOptions,
  useMenuOptions,
  usePermGroupOptions,
  usePermOptions,
  useRoleGroupOptions,
} from "@/lib/queries";
import { shortId } from "@/lib/utils";
import { Menu as MenuIcon, ShieldCheck } from "lucide-react";

function optionalText(value: FormValues[string]): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  // 空串显式传 null：ModifyDto 的 Option<String> 用 Some(None) 表达清空
  return text ? text : null;
}

/** 勾选集合的单个切换 / 批量增删，权限与菜单两个抽屉共用同一套语义。 */
function toggleIn(setter: Dispatch<SetStateAction<Set<string>>>, id: string) {
  setter((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
}

function setManyIn(
  setter: Dispatch<SetStateAction<Set<string>>>,
  ids: string[],
  checked: boolean,
) {
  setter((current) => {
    const next = new Set(current);
    for (const id of ids) {
      if (checked) next.add(id);
      else next.delete(id);
    }
    return next;
  });
}

/**
 * 授权抽屉：左侧权限分组树（单选导航），右侧 PermCheckList 列出选中分组（含子分组）
 * 下的权限点，联动选择。只保存 role-perm 差异；菜单授权是另一个独立抽屉。
 */
function RolePermsDrawer({
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const bindingsQuery = useQuery({
    queryKey: ["role-perm", "by-role", role?.id],
    queryFn: () => rolePermApi.list({ roleId: role!.id }),
    enabled: open,
  });
  const permsQuery = usePermOptions(open);
  const groupsQuery = usePermGroupOptions(open);

  // 切换角色时清空勾选，避免绑定尚未返回时沿用上一个角色的状态。
  useEffect(() => {
    setSelected(new Set());
  }, [role?.id]);

  useEffect(() => {
    if (!bindingsQuery.data) return;
    setSelected(new Set(bindingsQuery.data.map((binding) => binding.permId)));
  }, [bindingsQuery.data]);

  const save = async () => {
    if (!role) return;
    setSaving(true);
    try {
      const bindings = bindingsQuery.data ?? [];
      const original = new Set(bindings.map((binding) => binding.permId));
      const added = [...selected].filter((id) => !original.has(id));
      const removed = bindings.filter((binding) => !selected.has(binding.permId));
      await Promise.all([
        ...added.map((permId) => rolePermApi.add({ roleId: role.id, permId })),
        ...removed.map((binding) => rolePermApi.remove(binding.id)),
      ]);
      toast.success(`已更新「${role.name}」的权限（新增 ${added.length}，移除 ${removed.length}）`);
      await queryClient.invalidateQueries({ queryKey: ["role-perm"] });
      // 授权会影响当前用户可见菜单与首页，首页缓存一并失效。
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      // 改的可能正是当前账号所属角色：重新拉一次权限视图，侧栏与页面门禁立即生效。
      await refreshAuthz();
      onSaved();
      onClose();
    } catch (error) {
      // 差异逐条提交，可能部分成功；重新读取绑定让界面回到服务端真实状态。
      await bindingsQuery.refetch();
      toast.error(error instanceof Error ? error.message : "保存权限失败，已重新读取当前绑定");
    } finally {
      setSaving(false);
    }
  };

  const loading = bindingsQuery.isLoading || permsQuery.isLoading || groupsQuery.isLoading;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`授权 · ${role?.name ?? ""}`}
      description="左侧分组树可勾选「本组及全部子孙」的权限；点分组名切换右侧展示范围，右侧按该级以下的真实分组树展示，叶子分组直接平铺权限。两侧勾选同一份数据，双向联动；保存只提交差异。"
      width="w-full max-w-[900px]"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            取消
          </Button>
          <Button variant="primary" onClick={() => void save()} disabled={saving || loading}>
            {saving ? "保存中…" : `保存（${selected.size} 权限）`}
          </Button>
        </>
      }
    >
      {loading ? (
        <Spinner />
      ) : (permsQuery.data ?? []).length === 0 ? (
        <div className="rounded-xl border border-warn/30 bg-warn-soft px-3.5 py-3 text-[12px] leading-relaxed text-warn">
          还没有权限点。请先到「权限管理」登记接口权限，再回来授权。
        </div>
      ) : (
        <LinkedGroupSelector
          groups={groupsQuery.data ?? []}
          items={permsQuery.data ?? []}
          selectedIds={selected}
          onToggle={(id) => toggleIn(setSelected, id)}
          onSetMany={(ids, checked) => setManyIn(setSelected, ids, checked)}
          renderItem={(perm) => (
            <span className="flex flex-wrap items-baseline gap-x-2">
              {perm.name}
              <code className="font-mono text-[11px] text-muted">{perm.urn}</code>
              {!perm.enabled && <Badge tone="warn">停用</Badge>}
            </span>
          )}
          leftTitle="权限分组"
          rightTitle="权限"
          leftHint="勾选分组即勾选它和所有子分组下的权限；点名称只切换右侧展示范围。"
          rightHint="选中分组以下按真实层级展开；若没有子分组，这里直接平铺权限。"
          emptyText="该分组下暂无权限点。"
        />
      )}
    </Drawer>
  );
}

/**
 * 菜单抽屉：左栏应用、右栏该应用的菜单树，整组勾选与单节点勾选双向联动。
 * 只保存 role-menu 差异。
 */
function RoleMenusDrawer({
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [appTab, setAppTab] = useState<string | null>(null);

  const bindingsQuery = useQuery({
    queryKey: ["role-menu", "by-role", role?.id],
    queryFn: () => roleMenuApi.list({ roleId: role!.id }),
    enabled: open,
  });
  const menusQuery = useMenuOptions(open);
  const appsQuery = useAppOptions(open);
  const apps = appsQuery.data ?? [];
  // 左右两栏始终展示：默认停在第一个应用，单应用时也保持同样的布局。
  const activeApp =
    appTab && apps.some((app) => app.id === appTab) ? appTab : apps[0]?.id ?? null;

  useEffect(() => {
    setSelected(new Set());
    setAppTab(null);
  }, [role?.id]);

  useEffect(() => {
    if (!bindingsQuery.data) return;
    setSelected(new Set(bindingsQuery.data.map((binding) => binding.menuId)));
  }, [bindingsQuery.data]);

  const save = async () => {
    if (!role) return;
    setSaving(true);
    try {
      const bindings = bindingsQuery.data ?? [];
      const original = new Set(bindings.map((binding) => binding.menuId));
      const added = [...selected].filter((id) => !original.has(id));
      const removed = bindings.filter((binding) => !selected.has(binding.menuId));
      await Promise.all([
        ...added.map((menuId) => roleMenuApi.add({ roleId: role.id, menuId })),
        ...removed.map((binding) => roleMenuApi.remove(binding.id)),
      ]);
      toast.success(`已更新「${role.name}」的菜单（新增 ${added.length}，移除 ${removed.length}）`);
      await queryClient.invalidateQueries({ queryKey: ["role-menu"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await refreshAuthz();
      onSaved();
      onClose();
    } catch (error) {
      await bindingsQuery.refetch();
      toast.error(error instanceof Error ? error.message : "保存菜单失败，已重新读取当前绑定");
    } finally {
      setSaving(false);
    }
  };

  const loading = bindingsQuery.isLoading || menusQuery.isLoading || appsQuery.isLoading;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`菜单 · ${role?.name ?? ""}`}
      description="左栏应用可整组勾选并切换，右栏按选中应用展示完整菜单树、父子级联勾选；保存只提交差异，菜单变更对所属账号立即生效。"
      width="w-full max-w-[820px]"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            取消
          </Button>
          <Button variant="primary" onClick={() => void save()} disabled={saving || loading}>
            {saving ? "保存中…" : `保存（${selected.size} 菜单）`}
          </Button>
        </>
      }
    >
      {loading ? (
        <Spinner />
      ) : (menusQuery.data ?? []).length === 0 ? (
        <div className="rounded-xl border border-warn/30 bg-warn-soft px-3.5 py-3 text-[12px] leading-relaxed text-warn">
          还没有菜单。请先到「菜单管理」创建，再回来授权。
        </div>
      ) : (
        <LinkedMenuSelector
          apps={apps}
          menus={menusQuery.data ?? []}
          activeApp={activeApp}
          onSelectApp={setAppTab}
          selected={selected}
          onToggle={(id) => toggleIn(setSelected, id)}
          onSetMany={(ids, checked) => setManyIn(setSelected, ids, checked)}
        />
      )}
    </Drawer>
  );
}

export function RolesPage() {
  const toast = useToast();
  const [permRole, setPermRole] = useState<AdmRoleVo | null>(null);
  const [menuRole, setMenuRole] = useState<AdmRoleVo | null>(null);
  const queryClient = useQueryClient();

  const groupsQuery = useRoleGroupOptions();

  const groupName = useMemo(() => {
    const map = new Map<string, string>();
    for (const group of groupsQuery.data ?? []) map.set(group.id, group.name);
    return map;
  }, [groupsQuery.data]);

  const columns: CrudColumn<AdmRoleVo>[] = [
    {
      key: "name",
      label: "角色",
      className: "whitespace-nowrap",
      render: (row) => <span className="font-medium text-ink">{row.name}</span>,
    },
    {
      key: "groupId",
      label: "角色分组",
      className: "whitespace-nowrap",
      render: (row) => groupName.get(row.groupId) ?? shortId(row.groupId),
    },
    {
      key: "remark",
      label: "备注",
      truncate: true,
      truncateClassName: "max-w-[320px] max-[1400px]:max-w-[180px]",
    },
    { key: "enabled", label: "启用", className: "whitespace-nowrap", toggle: {} },
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

  const openPerms = async (row: AdmRoleVo) => {
    try {
      const detail = await roleApi.get(row.id);
      setPermRole(detail ?? row);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "读取角色详情失败");
    }
  };

  const openMenus = async (row: AdmRoleVo) => {
    try {
      const detail = await roleApi.get(row.id);
      setMenuRole(detail ?? row);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "读取角色详情失败");
    }
  };

  return (
    <>
      <CrudPage<AdmRoleVo>
        title="角色管理"
        subtitle="角色是权限与菜单的集合，按分组树组织。左侧按分组切换（含子分组）；「授权」与「菜单」是两个独立操作：授权按权限分组树勾选权限点，菜单按应用勾选可见菜单，配合可见范围决定「能做什么 / 能看哪些」。"
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
          <>
            <Button size="sm" variant="ghost" onClick={() => void openPerms(row)}>
              <ShieldCheck size={13} /> 授权
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void openMenus(row)}>
              <MenuIcon size={13} /> 菜单
            </Button>
          </>
        )}
      />

      <RolePermsDrawer
        role={permRole}
        onClose={() => setPermRole(null)}
        onSaved={() => void queryClient.invalidateQueries({ queryKey: ["role"] })}
      />
      <RoleMenusDrawer
        role={menuRole}
        onClose={() => setMenuRole(null)}
        onSaved={() => void queryClient.invalidateQueries({ queryKey: ["role"] })}
      />
    </>
  );
}