import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { ApiError } from "@/lib/http";
import { Button, Field, Input } from "@/components/ui/primitives";
import { ArrowRight, KeyRound, LoaderCircle, LockKeyhole, ShieldCheck } from "lucide-react";

const CODE_TEXT: Record<string, string> = {
  ADM00001: "账号或口令不正确。后端对「账号不存在」和「口令错误」使用同一个编码。",
  ADM00002: "账号已被锁定，请稍后再试或让管理员处理。",
  ADM00003: "账号已停用。",
  ADM00004: "账号已过期。",
  ADM00005: "令牌无效（登录阶段一般不会出现）。",
  ADM00006: "该登录标识命中多个账号，请改用登录名。",
};

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const rawReturn = params.get("returnUrl") ?? "/";
  const returnUrl = rawReturn.startsWith("/") && !rawReturn.startsWith("//") ? rawReturn : "/";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!account.trim() || !password) {
      setError("请填写账号与口令");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await login(account, password);
      navigate(returnUrl, { replace: true });
    } catch (reason) {
      if (reason instanceof ApiError) {
        setError(reason.code ? CODE_TEXT[reason.code] ?? reason.message : reason.message);
      } else {
        setError(reason instanceof Error ? reason.message : "登录失败");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[1.05fr_0.95fr]">
      <aside className="relative hidden overflow-hidden border-r border-line bg-[#101828] p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="grid-paper absolute inset-0 opacity-30" />
        <div className="relative">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-white">
              <ShieldCheck size={19} />
            </div>
            <div>
              <div className="text-[16px] font-semibold tracking-[-0.01em]">Adm Console</div>
              <div className="text-[11px] text-white/50">账号 · 角色 · 菜单 · 权限</div>
            </div>
          </div>

          <h1 className="mt-16 max-w-md text-[32px] font-semibold leading-[1.18] tracking-[-0.03em]">
            把账号、角色与权限
            <br />
            放在同一张桌面上。
          </h1>
          <p className="mt-4 max-w-md text-[13px] leading-relaxed text-white/65">
            直接对接 adm-svr 的 REST 接口：统一的 Ro 信封、字符串形态的雪花 ID、
            以及基于 role-user / role-menu / role-perm 的 RBAC 关系。
          </p>

          <ul className="mt-10 flex flex-col gap-3 text-[12.5px] text-white/70">
            <li className="flex items-center gap-2">
              <KeyRound size={15} className="text-[#8fb2ff]" />
              登录口令在浏览器侧先做一次 SM3，不以明文传输
            </li>
            <li className="flex items-center gap-2">
              <LockKeyhole size={15} className="text-[#8fb2ff]" />
              业务接口自动带 Authorization，中间件注入当前用户 ID
            </li>
            <li className="flex items-center gap-2">
              <ArrowRight size={15} className="text-[#8fb2ff]" />
              菜单与权限按当前账号的角色实时拼装
            </li>
          </ul>
        </div>

        <div className="relative text-[10.5px] leading-relaxed text-white/35">
          业务接口已由后端中间件校验 Bearer 令牌；界面上的权限门是第二层兜底，
          真正的拒止以服务端为准。
        </div>
      </aside>

      <main className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-[380px]">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white">
                <ShieldCheck size={17} />
              </div>
              <div className="text-[15px] font-semibold text-ink">Adm Console</div>
            </div>
          </div>

          <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-ink">登录管理后台</h2>
          <p className="mt-1.5 text-[12.5px] text-muted">
            使用 adm_user 里的登录名、手机号、邮箱或身份证号登录。
          </p>

          <form onSubmit={submit} className="mt-7 flex flex-col gap-4">
            <Field label="账号" required>
              <Input
                value={account}
                onChange={(event) => setAccount(event.target.value)}
                placeholder="登录名 / 手机号 / 邮箱 / 身份证号"
                autoFocus
                autoComplete="username"
              />
            </Field>
            <Field label="口令" required>
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="请输入口令"
                autoComplete="current-password"
              />
            </Field>

            {error && (
              <div className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-[12px] leading-relaxed text-danger">
                {error}
              </div>
            )}

            <Button type="submit" variant="primary" className="mt-1 h-10 w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <LoaderCircle size={14} className="animate-spin" /> 正在校验…
                </>
              ) : (
                <>
                  登录 <ArrowRight size={15} />
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 rounded-xl border border-line bg-sunken px-3.5 py-3 text-[11.5px] leading-relaxed text-muted">
            <div className="font-medium text-ink-soft">本地种子数据</div>
            <div className="mt-1">
              账号 <code className="font-mono text-ink-soft">admin</code>，口令{" "}
              <code className="font-mono text-ink-soft">admin123</code>。迁移脚本只插入了这一个账号，
              没有角色 / 菜单 / 权限行，因此 admin 会按「超级管理员」展示全部页面。
            </div>
          </div>

          <div className="mt-5 text-[11.5px] text-muted">
            接口前缀{" "}
            <code className="rounded bg-sunken px-1 py-0.5 font-mono text-ink-soft">
              {import.meta.env.VITE_API_BASE || "同源"}
            </code>
          </div>
        </div>
      </main>
    </div>
  );
}
