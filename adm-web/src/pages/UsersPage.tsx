import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { roleApi, roleGroupApi, roleUserApi, userApi } from "@/lib/api";
import type { CrudColumn, CrudField, FormMode } from "@/components/crud/CrudPage";
import { CrudPage } from "@/components/crud/CrudPage";
import { Badge, Button, Checkbox, Spinner } from "@/components/ui/primitives";
import { Drawer, useToast } from "@/components/ui/overlay";
import { sm3 } from "@/lib/sm3";
import type { AdmRoleVo, AdmUserVo, FormValues } from "@/lib/types";
import { KeyRound, ShieldCheck, UserCog } from "lucide-react";

function optionalText(value: FormValues[string]): string | undefined {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text : undefined;
}

const STATUS_TEXT: Record<number, { label: string; tone: "success" | "warn" | "danger" | "info" }> = {
  1: { label: "正常", tone: "success" },
  2: { label: "停用", tone: "warn" },
  3: { label: "锁定", tone: "danger" },
};

function UserRolesDrawer({
  user,
  onClose,
  onSaved,
}: {
  user: AdmUserVo | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const open = Boolean(user);
  const toast = useToast();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const bindingsQuery = useQuery({
    queryKey: ["role-user", "by-user", user?.id],
    queryFn: () => roleUserApi.list({ userId: user!.id }),
    enabled: open,
  });
  const rolesQuery = useQuery({
    queryKey: ["role", "all-for-user"],
    queryFn: () => roleApi.list({ _orderBy: "sort_order:asc" }),
    enabled: open,
  });
  const groupsQuery = useQuery({
    queryKey: ["roleGroup", "all-for-user"],
    queryFn: () => roleGroupApi.list(),
    enabled: open,
  });

  useEffect(() => {
    if (!bindingsQuery.data) return;
    setSelected(new Set(bindingsQuery.data.map((binding) => binding.roleId)));
  }, [bindingsQuery.data]);

  const roles = rolesQuery.data ?? [];
  const bindings = bindingsQuery.data ?? [];
  const groupName = useMemo(() => {
    const map = new Map<string, string>();
    for (const group of groupsQuery.data ?? []) map.set(group.id, group.name);
    return map;
  }, [groupsQuery.data]);

  const groups = useMemo(() => {
    const byGroup = new Map<string, AdmRoleVo[]>();
    for (const role of roles) {
      const list = byGroup.get(role.groupId) ?? [];
      list.push(role);
      byGroup.set(role.groupId, list);
    }
    return Array.from(byGroup.entries());
  }, [roles]);

  const toggle = (roleId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(roleId)) next.delete(roleId);
      else next.add(roleId);
      return next;
    });
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const originalIds = new Set(bindings.map((binding) => binding.roleId));
      const added = [...selected].filter((roleId) => !originalIds.has(roleId));
      const removed = bindings.filter((binding) => !selected.has(binding.roleId));
      await Promise.all([
        ...added.map((roleId) => roleUserApi.add({ userId: user.id, roleId })),
        ...removed.map((binding) => roleUserApi.remove(binding.id)),
      ]);
      toast.success(`已更新「${user.name}」的角色（新增 ${added.length}，移除 ${removed.length}）`);
      await queryClient.invalidateQueries({ queryKey: ["role-user"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      onSaved();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存角色失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`分配角色 · ${user?.name ?? ""}`}
      description="关系写入 /adm/role-user。保存时只提交新增与移除的差异。"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            取消
          </Button>
          <Button variant="primary" onClick={() => void save()} disabled={saving || bindingsQuery.isLoading || rolesQuery.isLoading}>
            {saving ? "保存中…" : `保存（${selected.size} 个角色）`}
          </Button>
        </>
      }
    >
      {bindingsQuery.isLoading || rolesQuery.isLoading || groupsQuery.isLoading ? (
        <Spinner />
      ) : roles.length === 0 ? (
        <div className="rounded-xl border border-warn/30 bg-warn-soft px-3.5 py-3 text-[12px] leading-relaxed text-warn">
          还没有角色数据。请先到「角色管理」创建角色，再回来分配。
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map(([groupId, groupRoles]) => (
            <section key={groupId}>
              <div className="mb-1.5 flex items-center gap-2 text-[11.5px] font-medium text-muted">
                <ShieldCheck size={13} />
                {groupName.get(groupId) ?? `分组 ${groupId}`}
              </div>
              <div className="flex flex-col gap-0.5 rounded-xl border border-line p-1.5">
                {groupRoles.map((role) => (
                  <label
                    key={role.id}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-sunken"
                  >
                    <Checkbox checked={selected.has(role.id)} onChange={() => toggle(role.id)} />
                    <span className="flex-1 text-[12.5px] text-ink-soft">{role.name}</span>
                    {!role.enabled && <Badge tone="warn">停用</Badge>}
                    <code className="font-mono text-[10.5px] text-muted">{role.sortOrder}</code>
                  </label>
                ))}
              </div>
            </section>
          ))}
          <p className="text-[11.5px] leading-relaxed text-muted">
            说明：用户本身没有 roleId 字段，用户与角色是多对多；同一个用户可以有多个角色，权限取并集。
          </p>
        </div>
      )}
    </Drawer>
  );
}

export function UsersPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [roleUser, setRoleUser] = useState<AdmUserVo | null>(null);

  const columns: CrudColumn<AdmUserVo>[] = [
    {
      key: "name",
      label: "登录名",
      render: (row) => (
        <div>
          <div className="font-medium text-ink">{row.name}</div>
          <div className="mt-0.5 text-[11px] text-muted">{row.nickName?.trim() || "--"}</div>
        </div>
      ),
    },
    { key: "mobile", label: "手机号" },
    { key: "email", label: "邮箱" },
    {
      key: "status",
      label: "状态",
      render: (row) => {
        const status = STATUS_TEXT[row.status] ?? { label: `状态 ${row.status}`, tone: "neutral" as const };
        return <Badge tone={status.tone}>{status.label}</Badge>;
      },
    },
    { key: "enabled", label: "启用", type: "boolean", booleanLabels: { on: "启用", off: "停用" } },
    { key: "lastLoginMs", label: "最近登录", type: "datetime" },
    { key: "createMs", label: "创建时间", type: "datetime" },
  ];

  const fields: CrudField[] = [
    { name: "name", label: "登录名", required: true, placeholder: "4-32 位，字母开头，可含数字与下划线" },
    { name: "nickName", label: "昵称", placeholder: "展示用，可重复" },
    { name: "mobile", label: "手机号", placeholder: "11 位，可留空", hint: "留空表示该账号不用于手机号登录" },
    { name: "email", label: "邮箱", placeholder: "可留空", hint: "留空表示该账号不用于邮箱登录" },
    {
      name: "status",
      label: "账号状态",
      type: "select",
      required: true,
      defaultValue: "1",
      options: [
        { value: "1", label: "1 · 正常" },
        { value: "2", label: "2 · 已停用" },
        { value: "3", label: "3 · 已锁定" },
      ],
    },
    { name: "enabled", label: "启用", type: "switch", defaultValue: true },
    {
      name: "loginPswd",
      label: "登录口令",
      type: "password",
      required: true,
      createOnly: true,
      hint: "必填。明文只在浏览器内做一次 SM3 后提交，服务端各自生成组合码。",
    },
    {
      name: "loginPswd",
      label: "新登录口令",
      type: "password",
      editOnly: true,
      hint: "留空则保持原口令。",
    },
    {
      name: "auditPswd",
      label: "审核口令",
      type: "password",
      hint: "可不填。启用审核功能前留空即可，与登录口令相互独立。",
    },
    {
      name: "payPswd",
      label: "支付口令",
      type: "password",
      hint: "可不填。启用支付功能前留空即可，与登录/审核口令相互独立。",
    },
    { name: "remark", label: "备注", type: "textarea", placeholder: "0-50 字" },
  ];

  const toForm = (row: AdmUserVo): FormValues => ({
    name: row.name,
    nickName: row.nickName ?? "",
    mobile: row.mobile ?? "",
    email: row.email ?? "",
    status: String(row.status ?? 1),
    enabled: row.enabled,
    loginPswd: "",
    auditPswd: "",
    payPswd: "",
    remark: row.remark ?? "",
  });

  const toPayload = (values: FormValues, mode: FormMode) => {
    const payload: Record<string, unknown> = {
      name: String(values.name ?? "").trim(),
      nickName: optionalText(values.nickName),
      mobile: optionalText(values.mobile),
      email: optionalText(values.email),
      status: Number(values.status ?? 1),
      enabled: Boolean(values.enabled),
      remark: optionalText(values.remark),
    };

    // 三套口令各自独立：谁填了就单独算一次 SM3 提交，绝不互相复用。
    // 组合码由服务端生成，这里传 6 位占位只是为了让 AddDto 的 @len 6..=6 通过。
    const attachPswd = (field: string) => {
      const plain = optionalText(values[field]);
      if (!plain) return;
      payload[field] = sm3(plain);
      payload[`${field}Salt`] = "000000";
    };

    if (mode === "create") {
      attachPswd("loginPswd");
      attachPswd("auditPswd");
      attachPswd("payPswd");
      // 审核 / 支付留空时显式提交空串，与「没传」区分开
      if (!payload.auditPswd) {
        payload.auditPswd = "";
        payload.auditPswdSalt = "";
      }
      if (!payload.payPswd) {
        payload.payPswd = "";
        payload.payPswdSalt = "";
      }
    } else {
      attachPswd("loginPswd");
      attachPswd("auditPswd");
      attachPswd("payPswd");
    }
    return payload;
  };

  const openRoles = async (row: AdmUserVo) => {
    try {
      const detail = await userApi.get(row.id);
      setRoleUser(detail ?? row);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "读取用户详情失败");
    }
  };

  const resetPassword = async (row: AdmUserVo) => {
    if (
      !window.confirm(
        `确定把「${row.name}」的登录口令重置为服务端默认口令？重置后该账号下次登录需立即修改。`,
      )
    ) {
      return;
    }
    try {
      await userApi.resetPassword(row.id);
      toast.success(`已重置「${row.name}」的登录口令`);
      await queryClient.invalidateQueries({ queryKey: ["user"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "重置口令失败");
    }
  };

  return (
    <>
      <CrudPage<AdmUserVo>
        title="用户管理"
        subtitle="账号、状态与登录口令。列表接口返回脱敏的手机号/邮箱/身份证/实名；编辑时会先取单条详情回显原值。"
        prefix="/adm/user"
        columns={columns}
        fields={fields}
        itemLabel={(row) => row.name}
        defaultOrderBy="update_ms:desc"
        searchPlaceholder="搜索登录名 / 昵称 / 手机号 / 邮箱 / 备注"
        filters={[
          {
            type: "select",
            name: "status",
            label: "账号状态",
            options: [
              { value: "1", label: "正常" },
              { value: "2", label: "停用" },
              { value: "3", label: "锁定" },
            ],
          },
          { type: "boolean", name: "enabled", label: "启用" },
          { type: "date-range", name: "create_ms", label: "创建时间" },
        ]}
        emptyDescription="后端种子只有一个 admin 账号；可以在这里新增更多账号。"
        toForm={toForm}
        toPayload={toPayload}
        rowActions={(row) => (
          <>
            <Button size="sm" variant="ghost" onClick={() => void openRoles(row)}>
              <UserCog size={13} /> 角色
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void resetPassword(row)}>
              <KeyRound size={13} /> 重置口令
            </Button>
          </>
        )}
      />

      <UserRolesDrawer
        user={roleUser}
        onClose={() => setRoleUser(null)}
        onSaved={() => void queryClient.invalidateQueries({ queryKey: ["user"] })}
      />
    </>
  );
}
