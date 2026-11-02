import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { menuApi, permApi, roleApi, userApi } from "@/lib/api";
import { formatMs } from "@/lib/utils";
import { Badge, PageHeader, Panel, Spinner } from "@/components/ui/primitives";
import {
  ArrowUpRight,
  BookOpenCheck,
  KeyRound,
  LayoutDashboard,
  Menu as MenuIcon,
  ShieldCheck,
  Users,
} from "lucide-react";

function StatCard({
  label,
  value,
  hint,
  icon,
  to,
}: {
  label: string;
  value: string;
  hint: string;
  icon: typeof Users;
  to: string;
}) {
  const Icon = icon;
  return (
    <Link
      to={to}
      className="group flex flex-col justify-between rounded-[14px] border border-line bg-surface p-4 shadow-panel transition-colors hover:border-line-strong"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11.5px] text-muted">{label}</div>
          <div className="tnum mt-1.5 text-[26px] font-semibold leading-none tracking-[-0.02em] text-ink">
            {value}
          </div>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-accent">
          <Icon size={16} />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-[11.5px] text-muted">
        <span>{hint}</span>
        <ArrowUpRight size={13} className="opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
    </Link>
  );
}

export function DashboardPage() {
  const { session, authz, authzError, authzLoading, refreshAuthz, hasPerm } = useAuth();

  const usersQuery = useQuery({
    queryKey: ["dashboard", "users"],
    queryFn: () => userApi.page({ _page: 1, _size: 1 }),
    enabled: hasPerm("GET:/adm/user"),
  });
  const rolesQuery = useQuery({
    queryKey: ["dashboard", "roles"],
    queryFn: () => roleApi.page({ _page: 1, _size: 1 }),
    enabled: hasPerm("GET:/adm/role"),
  });
  const menusQuery = useQuery({
    queryKey: ["dashboard", "menus"],
    queryFn: () => menuApi.page({ _page: 1, _size: 1 }),
    enabled: hasPerm("GET:/adm/menu"),
  });
  const permsQuery = useQuery({
    queryKey: ["dashboard", "perms"],
    queryFn: () => permApi.page({ _page: 1, _size: 1 }),
    enabled: hasPerm("GET:/adm/perm"),
  });

  const count = (value?: { total: string }) => (value ? value.total : "—");

  return (
    <div>
      <PageHeader
        title={`你好，${session?.nickName || session?.name || "管理员"}`}
        subtitle="这是 adm-web。左侧菜单与页面权限都来自 /adm/auth/me 返回的真实 RBAC 数据（角色 → 菜单 / 权限）。"
        actions={
          <>
            {authz && <Badge tone="neutral">{authz.roles.length} 个角色</Badge>}
            {session?.loginPswdDefault && <Badge tone="warn">初始口令</Badge>}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {(authzLoading || usersQuery.isLoading) && !authz && (
          <div className="col-span-full">
            <Spinner label="正在加载权限与统计…" />
          </div>
        )}
        {hasPerm("GET:/adm/user") && (
          <StatCard
            label="用户账号"
            value={count(usersQuery.data)}
            hint="登录名 / 状态 / 最近登录"
            icon={Users}
            to="/users"
          />
        )}
        {hasPerm("GET:/adm/role") && (
          <StatCard
            label="角色"
            value={count(rolesQuery.data)}
            hint="按角色分组维护"
            icon={ShieldCheck}
            to="/roles"
          />
        )}
        {hasPerm("GET:/adm/menu") && (
          <StatCard
            label="菜单节点"
            value={count(menusQuery.data)}
            hint="treeCode 路径枚举树"
            icon={MenuIcon}
            to="/menus"
          />
        )}
        {hasPerm("GET:/adm/perm") && (
          <StatCard
            label="权限点"
            value={count(permsQuery.data)}
            hint="URN 前缀匹配"
            icon={KeyRound}
            to="/permissions"
          />
        )}
      </div>

      {authzError && (
        <div className="mt-3 rounded-xl border border-danger/25 bg-danger-soft px-3.5 py-3 text-[12px] leading-relaxed text-danger">
          权限加载失败：{authzError}。可以在
          <button type="button" className="mx-1 underline underline-offset-2" onClick={() => void refreshAuthz()}>
            这里重试
          </button>
          ，或先检查 adm-svr 是否已启动。
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Panel
          title="当前会话"
          description="令牌与账号信息来自登录接口的 extra；前端不做续期。"
          actions={<Badge tone={session?.loginPswdDefault ? "warn" : "success"}>{session?.loginPswdDefault ? "初始口令" : "已登录"}</Badge>}
        >
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-[12.5px] sm:grid-cols-2">
            <div>
              <dt className="text-muted">登录名</dt>
              <dd className="mt-0.5 font-medium text-ink">{session?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">用户 ID</dt>
              <dd className="tnum mt-0.5 font-mono text-ink-soft">{session?.userId ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">令牌类型</dt>
              <dd className="mt-0.5 font-mono text-ink-soft">{session?.tokenType ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">令牌到期</dt>
              <dd className="mt-0.5 font-mono text-ink-soft">{formatMs(session?.expireMs)}</dd>
            </div>
            <div>
              <dt className="text-muted">会话 ID</dt>
              <dd className="mt-0.5 font-mono text-ink-soft">{session?.loginLogId ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">权限视图</dt>
              <dd className="mt-0.5 text-ink-soft">
                {authzLoading
                  ? "加载中…"
                  : authz
                    ? `${authz.roles.length} 角色 / ${authz.perms.length} 权限 / ${authz.menus.length} 菜单`
                    : "未加载"}
              </dd>
            </div>
          </dl>
        </Panel>

        <Panel title="从这里开始" description="按依赖顺序维护数据，菜单与权限才能串起来。">
          <ol className="flex flex-col gap-2.5 text-[12.5px] text-ink-soft">
            {[
              { step: "01", label: "领域与应用", text: "先建领域，再建应用；菜单挂在应用下。", to: "/apps" },
              { step: "02", label: "权限分组与权限", text: "按分组维护 URN，如 GET:/adm/user/page。", to: "/permissions" },
              { step: "03", label: "角色分组与角色", text: "角色按领域分组，再给角色授权。", to: "/roles" },
              { step: "04", label: "用户与授权", text: "给用户挂角色，权限随角色生效。", to: "/users" },
            ].map((item) => (
              <li key={item.step}>
                <Link
                  to={item.to}
                  className="flex items-start gap-3 rounded-lg border border-line px-3 py-2.5 transition-colors hover:border-line-strong hover:bg-sunken"
                >
                  <span className="tnum font-mono text-[11px] text-accent">{item.step}</span>
                  <span className="min-w-0">
                    <span className="block font-medium text-ink">{item.label}</span>
                    <span className="mt-0.5 block text-[11.5px] text-muted">{item.text}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel
          title="接口契约备注"
          description="以下结论来自 adm-api / adm-svr 源码，不是推测。"
          actions={<BookOpenCheck size={15} className="text-muted" />}
        >
          <ul className="flex flex-col gap-2 text-[12px] leading-relaxed text-ink-soft">
            <li>· 统一信封 <code className="font-mono text-[11.5px]">Ro{"{"} result, msg, timestamp, extra {"}"}</code>；分页列表在 <code className="font-mono text-[11.5px]">extra</code> 里。</li>
            <li>· ID 与毫秒时间戳都是字符串，前端全程不做 Number 转换。</li>
            <li>· 业务接口要求 <code className="font-mono text-[11.5px]">Authorization: Bearer &lt;token&gt;</code>，中间件校验后注入 <code className="font-mono text-[11.5px]">X-User-Id</code>；登录/登出不要求。</li>
            <li>· 登录口令是 <code className="font-mono text-[11.5px]">SM3(明文)</code> 的 64 位小写十六进制，明文不出浏览器。</li>
            <li>· 菜单与权限完全来自 <code className="font-mono text-[11.5px]">GET /adm/auth/me</code>，前端不再有超管启发式。</li>
          </ul>
        </Panel>

        <Panel
          title="环境"
          description="开发期通过 Vite 代理把 /api 转发到 adm-svr。"
          actions={<LayoutDashboard size={15} className="text-muted" />}
        >
          <dl className="grid grid-cols-1 gap-3 text-[12.5px] sm:grid-cols-2">
            <div>
              <dt className="text-muted">API 前缀</dt>
              <dd className="mt-0.5 font-mono text-ink-soft">{import.meta.env.VITE_API_BASE || "同源"}</dd>
            </div>
            <div>
              <dt className="text-muted">构建基路径</dt>
              <dd className="mt-0.5 font-mono text-ink-soft">{import.meta.env.BASE_URL}</dd>
            </div>
            <div>
              <dt className="text-muted">开发端口</dt>
              <dd className="mt-0.5 font-mono text-ink-soft">5181</dd>
            </div>
            <div>
              <dt className="text-muted">后端默认端口</dt>
              <dd className="mt-0.5 font-mono text-ink-soft">9007（adm-svr.toml）</dd>
            </div>
          </dl>
        </Panel>
      </div>
    </div>
  );
}
