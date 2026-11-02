import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/primitives";
import { ShieldAlert } from "lucide-react";

/** 未登录 → 登录页，并把当前地址带回去。 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const location = useLocation();
  if (!session) {
    const returnUrl = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?returnUrl=${encodeURIComponent(returnUrl)}`} replace />;
  }
  return <>{children}</>;
}

/**
 * 页面级权限门：后端菜单已按角色过滤，这里再按权限 URN 做一层界面兜底。
 * 真正的拒止由 adm-svr 的 Bearer 鉴权中间件负责。
 */
export function RequirePerm({ perm, children }: { perm: string; children: ReactNode }) {
  const { hasPerm, session } = useAuth();
  if (!session) return null;
  if (hasPerm(perm)) return <>{children}</>;
  return (
    <section className="mx-auto max-w-lg px-6 py-20 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-warn-soft text-warn">
        <ShieldAlert size={26} />
      </div>
      <h1 className="mt-5 text-[20px] font-semibold text-ink">没有访问权限</h1>
      <p className="mt-2 text-[13px] leading-relaxed text-muted">
        当前账号没有权限 URN 前缀 <code className="rounded bg-sunken px-1.5 py-0.5 font-mono text-[12px] text-ink-soft">{perm}</code>
        。请让管理员在「角色 → 授权」里分配对应权限。
      </p>
      <div className="mt-5 flex justify-center">
        <Button onClick={() => window.location.assign("/")}>回到工作台</Button>
      </div>
    </section>
  );
}
