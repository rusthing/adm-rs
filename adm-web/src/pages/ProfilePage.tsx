import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/auth/AuthContext";
import { authApi, userApi } from "@/lib/api";
import { cn, formatMs } from "@/lib/utils";
import { sm3 } from "@/lib/sm3";
import { Badge, Button, Field, Input, PageHeader, Panel, Spinner, Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/overlay";
import { ChevronDown, KeyRound, LoaderCircle, RefreshCw, ShieldCheck, UserCircle } from "lucide-react";

interface ProfileForm {
  nickName: string;
  mobile: string;
  email: string;
  remark: string;
}

const EMPTY_FORM: ProfileForm = { nickName: "", mobile: "", email: "", remark: "" };

function optionalText(value: string): string | undefined {
  const text = value.trim();
  return text ? text : undefined;
}

/**
 * 把权限 URN（`GET:/adm/perm-group/delete-preview/{id}`）收敛成「操作对象」：
 * 取 `/adm/` 之后的第一段。`auth` 归到一处，拆不出来的落到 `adm`。
 *
 * 授权多的账号有几百条 URN，平铺成一整块等于什么都看不清；按对象折叠后
 * 「我到底能碰哪些东西」一眼可见，要看细节再展开。
 */
function resourceOfUrn(urn: string): string {
  const path = urn.slice(urn.indexOf(":") + 1);
  const segments = path.split("/").filter(Boolean);
  const admIndex = segments.indexOf("adm");
  return (admIndex >= 0 ? segments[admIndex + 1] : segments[0]) ?? "adm";
}

export function ProfilePage() {
  const { session, authz, authzError, authzLoading, refreshAuthz, updateSession } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM);
  const [savingProfile, setSavingProfile] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const userQuery = useQuery({
    queryKey: ["user", "profile", session?.userId],
    queryFn: () => userApi.get(session!.userId),
    enabled: Boolean(session),
  });

  useEffect(() => {
    const user = userQuery.data;
    if (!user) return;
    setForm({
      nickName: user.nickName ?? "",
      mobile: user.mobile ?? "",
      email: user.email ?? "",
      remark: user.remark ?? "",
    });
  }, [userQuery.data]);

  const roleNames = authz?.roles ?? [];

  /** 权限 URN 按操作对象分组；默认全收起，只留数量。 */
  const permGroups = useMemo(() => {
    const byResource = new Map<string, string[]>();
    for (const urn of authz?.permUrns ?? []) {
      const resource = resourceOfUrn(urn);
      const list = byResource.get(resource) ?? [];
      list.push(urn);
      byResource.set(resource, list);
    }
    return [...byResource.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  }, [authz?.permUrns]);

  const [openResources, setOpenResources] = useState<Set<string>>(new Set());

  const toggleResource = (resource: string) => {
    setOpenResources((current) => {
      const next = new Set(current);
      if (next.has(resource)) next.delete(resource);
      else next.add(resource);
      return next;
    });
  };

  const saveProfile = async () => {
    if (!session) return;
    setSavingProfile(true);
    try {
      await userApi.modify({
        id: session.userId,
        nickName: optionalText(form.nickName),
        mobile: optionalText(form.mobile),
        email: optionalText(form.email),
        remark: optionalText(form.remark),
      });
      toast.success("个人资料已保存");
      await queryClient.invalidateQueries({ queryKey: ["user", "profile"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async () => {
    if (!session) return;
    setPasswordError(null);
    if (!oldPassword) {
      setPasswordError("请输入当前口令");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("新口令至少 6 位");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("两次输入的口令不一致");
      return;
    }
    setSavingPassword(true);
    try {
      await authApi.changePassword({
        oldPswd: sm3(oldPassword),
        newPswd: sm3(newPassword),
      });
      updateSession({ loginPswdDefault: false });
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("口令已更新。旧令牌仍然有效，直到过期或登出。");
    } catch (error) {
      const message = error instanceof Error ? error.message : "修改口令失败";
      setPasswordError(message);
      toast.error(message);
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="个人中心"
        subtitle="查看当前账号信息、角色与权限视图；修改昵称/联系方式与登录口令。"
        actions={<Badge tone={roleNames.length > 0 ? "info" : "neutral"}>{roleNames.length > 0 ? `${roleNames.length} 个角色` : "未分配角色"}</Badge>}
      />

      {userQuery.isLoading ? (
        <Spinner />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr]">
          <Panel title="账号信息" description="数据来自 GET /adm/user/{id}。" actions={<UserCircle size={15} className="text-muted" />}>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-[12.5px] sm:grid-cols-2">
              <div>
                <dt className="text-muted">登录名</dt>
                <dd className="mt-0.5 font-medium text-ink">{userQuery.data?.name ?? session?.name}</dd>
              </div>
              <div>
                <dt className="text-muted">用户 ID</dt>
                <dd className="tnum mt-0.5 font-mono text-ink-soft">{session?.userId}</dd>
              </div>
              <div>
                <dt className="text-muted">账号状态</dt>
                <dd className="mt-0.5">
                  <Badge tone={userQuery.data?.enabled ? "success" : "warn"}>
                    {userQuery.data?.enabled ? "启用" : "停用"}
                  </Badge>
                  {userQuery.data && <span className="ml-2 text-[11.5px] text-muted">status = {userQuery.data.status}</span>}
                </dd>
              </div>
              <div>
                <dt className="text-muted">最近登录</dt>
                <dd className="mt-0.5 font-mono text-[11.5px] text-ink-soft">{formatMs(userQuery.data?.lastLoginMs)}</dd>
              </div>
              <div>
                <dt className="text-muted">初始口令</dt>
                <dd className="mt-0.5">
                  <Badge tone={session?.loginPswdDefault ? "warn" : "success"}>
                    {session?.loginPswdDefault ? "仍为初始口令" : "已修改"}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="text-muted">令牌到期</dt>
                <dd className="mt-0.5 font-mono text-[11.5px] text-ink-soft">{formatMs(session?.expireMs)}</dd>
              </div>
            </dl>
          </Panel>

          <Panel
            title="角色与权限"
            description="角色、权限与菜单均由 GET /adm/auth/me 聚合返回。"
            actions={<ShieldCheck size={15} className="text-muted" />}
          >
            {authzLoading ? (
              <Spinner label="加载中…" />
            ) : (
              <div className="flex flex-col gap-3 text-[12.5px]">
                <div>
                  <div className="text-muted">角色</div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {roleNames.length === 0 ? (
                      <span className="text-[11.5px] text-muted">没有分配角色。</span>
                    ) : (
                      roleNames.map((role) => (
                        <Badge key={role.id} tone="info">
                          {role.name}
                        </Badge>
                      ))
                    )}
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted">
                      权限（{authz?.permUrns.length ?? 0} 项 / {permGroups.length} 类对象）
                    </span>
                    {permGroups.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setOpenResources((current) =>
                            current.size === permGroups.length
                              ? new Set()
                              : new Set(permGroups.map(([resource]) => resource)),
                          )
                        }
                        className="shrink-0 rounded px-1.5 py-0.5 text-[11px] text-accent hover:bg-accent-soft"
                      >
                        {openResources.size === permGroups.length ? "全部收起" : "全部展开"}
                      </button>
                    )}
                  </div>
                  {permGroups.length === 0 ? (
                    <p className="mt-1.5 text-[11.5px] text-muted">没有权限行。</p>
                  ) : (
                    <div className="mt-1.5 flex max-h-56 flex-col gap-1 overflow-y-auto">
                      {permGroups.map(([resource, urns]) => {
                        const open = openResources.has(resource);
                        return (
                          <div key={resource} className="rounded-lg border border-line">
                            <button
                              type="button"
                              onClick={() => toggleResource(resource)}
                              className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-sunken"
                            >
                              <span className="text-[11.5px] font-medium text-ink-soft">{resource}</span>
                              <span className="tnum text-[10.5px] text-muted">{urns.length}</span>
                              <span className="flex-1" />
                              <ChevronDown
                                size={12}
                                className={cn("shrink-0 text-muted transition-transform", open && "rotate-180")}
                              />
                            </button>
                            {open && (
                              <div className="flex flex-wrap gap-1 border-t border-line px-2 py-1.5">
                                {urns.map((urn) => (
                                  <code
                                    key={urn}
                                    className="rounded bg-sunken px-1.5 py-0.5 font-mono text-[10.5px] text-ink-soft"
                                  >
                                    {urn}
                                  </code>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                {authzError && <p className="text-[11.5px] text-danger">权限加载失败：{authzError}</p>}
                <Button size="sm" variant="secondary" onClick={() => void refreshAuthz()} disabled={authzLoading}>
                  <RefreshCw size={13} className={authzLoading ? "animate-spin" : ""} /> 刷新权限
                </Button>
              </div>
            )}
          </Panel>

          <Panel title="修改资料" description="只提交这里可见的字段；后端 ModifyDto 的其余字段保持原值。">
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <Field label="登录名" hint="登录名是唯一标识，个人中心不提供修改。">
                <Input value={userQuery.data?.name ?? ""} disabled />
              </Field>
              <Field label="昵称">
                <Input value={form.nickName} onChange={(event) => setForm({ ...form, nickName: event.target.value })} />
              </Field>
              <Field label="手机号" hint="留空表示不修改；后端 modify 不支持把可选字段清空。">
                <Input value={form.mobile} onChange={(event) => setForm({ ...form, mobile: event.target.value })} />
              </Field>
              <Field label="邮箱" hint="留空表示不修改。">
                <Input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="备注">
                  <Textarea value={form.remark} onChange={(event) => setForm({ ...form, remark: event.target.value })} />
                </Field>
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <Button variant="primary" onClick={() => void saveProfile()} disabled={savingProfile}>
                {savingProfile ? "保存中…" : "保存资料"}
              </Button>
            </div>
          </Panel>

          <Panel
            title="修改登录口令"
            description="独立改密接口 POST /adm/auth/change-password：旧/新口令在浏览器内各做一次 SM3，服务端再生成新的 6 位组合码。"
            actions={<KeyRound size={15} className="text-muted" />}
          >
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="当前口令" required hint="用于校验身份；明文不会离开浏览器。">
                  <Input
                    type="password"
                    value={oldPassword}
                    autoComplete="current-password"
                    onChange={(event) => setOldPassword(event.target.value)}
                  />
                </Field>
              </div>
              <Field label="新口令" required hint="至少 6 位；明文不会离开浏览器。">
                <Input
                  type="password"
                  value={newPassword}
                  autoComplete="new-password"
                  onChange={(event) => setNewPassword(event.target.value)}
                />
              </Field>
              <Field label="确认新口令" required>
                <Input
                  type="password"
                  value={confirmPassword}
                  autoComplete="new-password"
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </Field>
            </div>
            {passwordError && <p className="mt-2 text-[11.5px] text-danger">{passwordError}</p>}
            <div className="mt-3 flex items-center justify-between gap-2">
              <p className="text-[11.5px] leading-relaxed text-muted">
                只改当前账号的登录口令，不再复用 PUT /adm/user。
              </p>
              <Button variant="primary" onClick={() => void changePassword()} disabled={savingPassword}>
                {savingPassword ? (
                  <>
                    <LoaderCircle size={14} className="animate-spin" /> 提交中…
                  </>
                ) : (
                  "修改口令"
                )}
              </Button>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
