import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { roleUserApi, userApi } from "@/lib/api";
import type { CrudColumn, CrudField, FormMode } from "@/components/crud/CrudPage";
import { CrudPage } from "@/components/crud/CrudPage";
import { Badge, Button, Checkbox, Spinner } from "@/components/ui/primitives";
import { Drawer, useConfirm, useToast } from "@/components/ui/overlay";
import { sm3 } from "@/lib/sm3";
import type { AdmRoleVo, AdmUserVo, FormValues } from "@/lib/types";
import { useRoleGroupOptions, useRoleOptions } from "@/lib/queries";
import { shortId } from "@/lib/utils";
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
  const rolesQuery = useRoleOptions(open);
  const groupsQuery = useRoleGroupOptions(open);

  // 切换用户时先清空勾选，避免在新用户的绑定还没返回前沿用上一位用户的选中状态。
  useEffect(() => {
    setSelected(new Set());
  }, [user?.id]);

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
    // 分组顺序跟随分组树（tree_code 升序），而不是角色先出现谁就排谁。
    const order = new Map((groupsQuery.data ?? []).map((group, index) => [group.id, index]));
    return Array.from(byGroup.entries()).sort(
      (a, b) =>
        (order.get(a[0]) ?? Number.MAX_SAFE_INTEGER) - (order.get(b[0]) ?? Number.MAX_SAFE_INTEGER) ||
        a[0].localeCompare(b[0]),
    );
  }, [roles, groupsQuery.data]);

  const toggle = (roleId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(roleId)) next.delete(roleId);
      else next.add(roleId);
      return next;
    });
  };

  /** 按分组批量勾选 / 清空角色。 */
  const setMany = (ids: string[], checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (checked) next.add(id);
        else next.delete(id);
      }
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
      // 差异是逐条提交的，可能部分成功；回到服务端真实绑定，避免界面与库不一致。
      await bindingsQuery.refetch();
      toast.error(error instanceof Error ? error.message : "保存角色失败，已重新读取当前绑定");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`分配角色 · ${user?.name ?? ""}`}
      description="保存时只提交新增与移除的差异；同一个用户可以属于多个角色。"
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
          {groups.map(([groupId, groupRoles]) => {
            const ids = groupRoles.map((role) => role.id);
            const checkedCount = ids.reduce((count, id) => count + (selected.has(id) ? 1 : 0), 0);
            return (
              <section key={groupId}>
                <div className="mb-1.5 flex items-center gap-2 text-[11.5px] font-medium text-muted">
                  <ShieldCheck size={13} />
                  <span className="truncate">{groupName.get(groupId) ?? shortId(groupId)}</span>
                  <span className="shrink-0 text-[10.5px] text-muted/70">
                    {checkedCount}/{ids.length}
                  </span>
                  <span className="flex-1" />
                  <button
                    type="button"
                    onClick={() => setMany(ids, true)}
                    disabled={checkedCount >= ids.length}
                    className="shrink-0 rounded px-1.5 py-0.5 text-[11px] text-accent hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    全选本组
                  </button>
                  <button
                    type="button"
                    onClick={() => setMany(ids, false)}
                    disabled={checkedCount === 0}
                    className="shrink-0 rounded px-1.5 py-0.5 text-[11px] text-muted hover:bg-sunken disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    清空本组
                  </button>
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
            );
          })}
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
  const confirm = useConfirm();
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
    { key: "enabled", label: "启用", toggle: {} },
    { key: "lastLoginMs", label: "最近登录", type: "datetime" },
    { key: "createMs", label: "创建时间", type: "datetime" },
  ];

  const fields: CrudField[] = [
    {
      name: "name",
      label: "登录名",
      required: true,
      placeholder: "4-32 位，字母开头，可含数字与下划线",
      validate: (value) =>
        /^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(String(value ?? "").trim())
          ? null
          : "登录名需 4-32 位，字母开头，只含字母、数字与下划线",
    },
    { name: "nickName", label: "昵称", placeholder: "展示用，可重复" },
    {
      name: "mobile",
      label: "手机号",
      placeholder: "11 位，可留空",
      hint: "留空表示该账号不用于手机号登录",
      validate: (value) => {
        const text = String(value ?? "").trim();
        return !text || /^1\d{10}$/.test(text) ? null : "手机号需为 11 位数字，且以 1 开头";
      },
    },
    {
      name: "email",
      label: "邮箱",
      placeholder: "可留空",
      hint: "留空表示该账号不用于邮箱登录",
      validate: (value) => {
        const text = String(value ?? "").trim();
        return !text || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) ? null : "邮箱格式不正确";
      },
    },
    {
      name: "loginPswd",
      key: "loginPswd-create",
      label: "登录口令",
      type: "password",
      required: true,
      createOnly: true,
      hint: "必填。明文只在浏览器内做一次 SM3 后提交。",
    },
    {
      name: "loginPswd",
      key: "loginPswd-edit",
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
      remark: optionalText(values.remark),
    };

    // 三套口令各自独立：谁填了就单独算一次 SM3 提交，绝不互相复用。
    // 组合码由服务端在写库钩子里随机生成并覆盖，客户端传的 *Salt 一律被忽略，
    // 所以这里不发送任何盐字段，免得请求看起来像「客户端可以指定组合码」。
    const attachPswd = (field: string) => {
      const plain = optionalText(values[field]);
      if (!plain) return;
      payload[field] = sm3(plain);
    };

    if (mode === "create") {
      attachPswd("loginPswd");
      attachPswd("auditPswd");
      attachPswd("payPswd");
      // 审核 / 支付留空时显式提交空串，与「没传」区分开（新增时列是 NOT NULL）
      if (!payload.auditPswd) payload.auditPswd = "";
      if (!payload.payPswd) payload.payPswd = "";
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
    const ok = await confirm({
      title: "重置登录口令",
      description: `确定把「${row.name}」的登录口令重置为服务端默认口令？重置后该账号下次登录需立即修改。`,
      confirmText: "重置",
      tone: "danger",
    });
    if (!ok) return;
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
