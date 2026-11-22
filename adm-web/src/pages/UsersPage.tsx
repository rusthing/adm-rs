import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { roleUserApi, userApi } from "@/lib/api";
import type { CrudColumn, CrudField, FormMode } from "@/components/crud/CrudPage";
import { CrudPage } from "@/components/crud/CrudPage";
import { ScopePanel } from "@/components/crud/scope-panel";
import { LinkedGroupSelector } from "@/components/crud/linked-group";
import type { CrudScopeDef } from "@/components/crud/scope";
import { idInQuery, subtreeIds } from "@/components/crud/scope";
import { Badge, Button, Spinner } from "@/components/ui/primitives";
import { Drawer, useConfirm, useToast } from "@/components/ui/overlay";
import { sm3 } from "@/lib/sm3";
import type { AdmUserVo, FormValues, PageQuery } from "@/lib/types";
import {
  useOrgOptions,
  useOrgUserBindings,
  usePersonOptions,
  useRealmOptions,
  useRealmUserBindings,
  useRoleGroupOptions,
  useRoleOptions,
} from "@/lib/queries";
import { formatMs, shortId } from "@/lib/utils";
import { KeyRound, UserCog } from "lucide-react";

function optionalText(value: FormValues[string]): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  // 空串显式传 null：ModifyDto 的 Option<String> 用 Some(None) 表达清空
  return text ? text : null;
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

  // 切换用户时先清空勾选，避免沿用上一位用户的状态。
  useEffect(() => {
    setSelected(new Set());
  }, [user?.id]);

  useEffect(() => {
    if (!bindingsQuery.data) return;
    setSelected(new Set(bindingsQuery.data.map((binding) => binding.roleId)));
  }, [bindingsQuery.data]);

  const roles = rolesQuery.data ?? [];
  const bindings = bindingsQuery.data ?? [];

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
      description="左栏角色分组可整组勾选、点名称切换右栏；右栏按该级以下的真实分组树展示，叶子分组直接平铺角色。两栏双向联动，保存只提交差异。"
      width="w-full max-w-[880px]"
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
        <LinkedGroupSelector
          groups={groupsQuery.data ?? []}
          items={roles}
          selectedIds={selected}
          onToggle={toggle}
          onSetMany={setMany}
          renderItem={(role) => (
            <span className="flex flex-wrap items-baseline gap-x-2">
              {role.name}
              {!role.enabled && <span className="text-[10px] text-warn">停用</span>}
              <code className="font-mono text-[10.5px] text-muted">{role.sortOrder}</code>
            </span>
          )}
          leftTitle="角色分组"
          rightTitle="角色"
          leftHint="勾选分组即勾选它和所有子分组下的角色；点名称只切换右侧展示范围。"
          rightHint="选中分组以下按真实层级展开；没有子分组时直接平铺角色。"
          emptyText="该分组下暂无角色。"
        />
      )}
    </Drawer>
  );
}

export function UsersPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [roleUser, setRoleUser] = useState<AdmUserVo | null>(null);
  const personsQuery = usePersonOptions();

  /** personId → 人员档案；列表返回的姓名是服务端遮蔽值（张*），所以靠工号区分人。 */
  const personById = useMemo(() => {
    const map = new Map<string, { name: string; code?: string }>();
    for (const person of personsQuery.data ?? []) {
      map.set(person.id, { name: person.name, code: person.code });
    }
    return map;
  }, [personsQuery.data]);

  // ---- 领域 tab：领域多于一个时顶部切换，按 realm_user 绑定收窄用户 ----
  const realmsQuery = useRealmOptions();
  const realms = realmsQuery.data ?? [];
  const [realmTab, setRealmTab] = useState<string | null>(null);
  const showRealmTabs = realms.length > 1;
  const realmUserBindings = useRealmUserBindings(showRealmTabs);
  const activeRealm = realmTab && realms.some((realm) => realm.id === realmTab) ? realmTab : null;

  // ---- 左侧组织树：组织非空即展示，选中组织（含子组织）按 org_user 绑定收窄用户 ----
  const orgsQuery = useOrgOptions();
  const orgs = orgsQuery.data ?? [];
  const [orgSelected, setOrgSelected] = useState<string | null>(null);
  const orgUserBindings = useOrgUserBindings(orgs.length > 0);
  const activeOrg = orgSelected && orgs.some((org) => org.id === orgSelected) ? orgSelected : null;
  const orgScope: CrudScopeDef = {
    title: "组织",
    param: "org_id",
    field: "orgId",
    hideWhenSingle: false,
    options: orgs.map((org) => ({
      value: org.id,
      label: org.name,
      treeCode: org.treeCode,
      description: org.treeCode,
      disabled: !org.enabled,
    })),
    loading: orgsQuery.isLoading,
    emptyText: "还没有组织，请先到「组织管理」创建。",
    hint: "选中组织后只列该组织（含子组织）下的用户。",
  };

  /** 领域命中的用户 id 集合；未选领域为 null（不收窄）。 */
  const realmUserIds = useMemo(() => {
    if (!activeRealm) return null;
    return new Set(
      (realmUserBindings.data ?? [])
        .filter((binding) => binding.realmId === activeRealm)
        .map((binding) => binding.userId),
    );
  }, [activeRealm, realmUserBindings.data]);

  /** 选中组织子树命中的用户 id 集合；未选组织为 null。选了领域时只认该领域下的任职。 */
  const orgUserIds = useMemo(() => {
    if (!activeOrg) return null;
    const orgIds = new Set(subtreeIds(orgs, activeOrg));
    return new Set(
      (orgUserBindings.data ?? [])
        .filter((binding) => orgIds.has(binding.orgId))
        .filter((binding) => !activeRealm || binding.realmId === activeRealm)
        .map((binding) => binding.userId),
    );
  }, [activeOrg, activeRealm, orgs, orgUserBindings.data]);

  /** 领域与组织同时选中时取交集，折成 `id` 的 is_in 条件。 */
  const extraQuery = useMemo<PageQuery>(() => {
    let ids: string[] | null = null;
    if (realmUserIds && orgUserIds) ids = [...realmUserIds].filter((id) => orgUserIds.has(id));
    else if (realmUserIds) ids = [...realmUserIds];
    else if (orgUserIds) ids = [...orgUserIds];
    return ids ? idInQuery(ids) : {};
  }, [realmUserIds, orgUserIds]);

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
    {
      key: "personId",
      label: "人员档案",
      className: "whitespace-nowrap",
      render: (row) => {
        if (!row.personId) {
          return (
            <span
              className="text-muted"
              title="纯账号：外部认证、系统账号或机器人，不挂在人员档案上"
            >
              纯账号
            </span>
          );
        }
        const person = personById.get(row.personId);
        if (!person) return <span className="text-muted">{shortId(row.personId)}</span>;
        return (
          <span className="inline-flex flex-col">
            <span className="text-ink-soft">{person.code || person.name}</span>
            {person.code && <span className="text-[10.5px] text-muted">{person.name}</span>}
          </span>
        );
      },
    },
    {
      key: "mobile",
      label: "联系方式",
      className: "whitespace-nowrap",
      render: (row) => (
        <span className="inline-flex flex-col">
          <span className="text-ink-soft">{row.mobile || "--"}</span>
          <span className="text-[10.5px] text-muted">{row.email || "--"}</span>
        </span>
      ),
    },
    {
      key: "realName",
      label: "实名",
      className: "whitespace-nowrap",
      render: (row) => {
        if (!row.realName && !row.idCard) return <span className="text-muted">未实名</span>;
        return (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-flex flex-col">
              <span className="text-ink-soft">{row.realName || "--"}</span>
              <code className="font-mono text-[10.5px] text-muted">{row.idCard || "--"}</code>
            </span>
            <Badge tone={row.realNameVerified ? "success" : "warn"}>
              {row.realNameVerified ? "已核验" : "待核验"}
            </Badge>
          </span>
        );
      },
    },
    {
      key: "status",
      label: "状态",
      className: "whitespace-nowrap",
      render: (row) => {
        const status = STATUS_TEXT[row.status] ?? { label: `状态 ${row.status}`, tone: "neutral" as const };
        return (
          <span className="inline-flex flex-col gap-0.5">
            <Badge tone={status.tone}>{status.label}</Badge>
            {row.status === 3 && row.lockUntilMs ? (
              <span className="text-[10.5px] text-muted">锁至 {formatMs(row.lockUntilMs).slice(5, 16)}</span>
            ) : row.failCount > 0 ? (
              <span className="text-[10.5px] text-warn">失败 {row.failCount} 次</span>
            ) : null}
          </span>
        );
      },
    },
    { key: "lastLoginMs", label: "最近登录", type: "datetime" },
    { key: "createMs", label: "创建时间", type: "datetime" },
    { key: "enabled", label: "启用", toggle: {} },
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
      name: "personId",
      label: "关联人员",
      type: "select",
      options: (personsQuery.data ?? []).map((person) => ({
        value: person.id,
        label: person.code ? `${person.code} · ${person.name}` : person.name,
      })),
      hint: personsQuery.data?.length
        ? "选人员档案表示「这个人用这个账号登录」；不选是纯账号（外部认证、系统账号、机器人）。列表里的姓名已遮蔽，按工号区分人。"
        : "还没有人员档案。先在「人员管理」录入人员，再回来关联；不关联即纯账号。",
    },
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
    personId: row.personId ?? "",
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

    // personId 只在真的选了人员时提交：更新接口把「没传」与「传 null」都当成
    // 未修改（ActiveValue::NotSet），传空串反而会撞 u64 反序列化，所以直接省略。
    const personId = optionalText(values.personId);
    if (personId) payload.personId = personId;

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
        subtitle="账号是能登录的凭据；人员档案是自然人（在「人员管理」维护），一个自然人可挂多个账号，不关联人员的即纯账号。领域多于一个时按顶部 tab 切换；组织非空时左侧组织树选中后只列该组织（含子组织）下的用户。列表里的手机 / 邮箱 / 身份证 / 姓名都是服务端遮蔽值，编辑时会先取单条详情回显原值。"
        prefix="/adm/user"
        columns={columns}
        fields={fields}
        itemLabel={(row) => row.name}
        defaultOrderBy="update_ms:desc"
        searchPlaceholder="搜索登录名 / 昵称 / 手机号 / 邮箱 / 身份证 / 实名 / 备注"
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
        sidePanel={
          orgs.length > 0 ? (
            <ScopePanel
              scope={orgScope}
              selected={activeOrg}
              onSelect={setOrgSelected}
              className="lg:w-[224px] lg:shrink-0"
            />
          ) : undefined
        }
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
        emptyDescription="种子带 admin（系统管理员）、super（平台管理员）、owl（审计员）、system（纯账号）四个账号；都在这里维护。"
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
