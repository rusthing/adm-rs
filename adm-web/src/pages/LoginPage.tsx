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
  // 只接受站内绝对路径：拒绝 //host、反斜杠变形、控制字符，以及 /login 自跳转。
  const returnUrl =
    rawReturn.startsWith("/") &&
    !rawReturn.startsWith("//") &&
    !rawReturn.includes("\\") &&
    !/[\u0000-\u001f]/.test(rawReturn) &&
    rawReturn.split(/[?#]/)[0] !== "/login"
      ? rawReturn
      : "/";

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
            账号、角色、菜单与授权关系集中维护；登录后所见即所用，
            可见页面按当前账号的授权实时下发。
          </p>

          <ul className="mt-10 flex flex-col gap-3 text-[12.5px] text-white/70">
            <li className="flex items-center gap-2">
              <KeyRound size={15} className="text-[#8fb2ff]" />
              登录口令在浏览器侧先做摘要处理，不以明文传输
            </li>
            <li className="flex items-center gap-2">
              <LockKeyhole size={15} className="text-[#8fb2ff]" />
              每次操作都携带登录态，由服务端识别当前用户
            </li>
            <li className="flex items-center gap-2">
              <ArrowRight size={15} className="text-[#8fb2ff]" />
              菜单与权限按当前账号的角色实时拼装
            </li>
          </ul>
        </div>

        <div className="relative text-[10.5px] leading-relaxed text-white/35">
          界面仅按授权展示可用功能；所有操作最终以服务端的鉴权结果为准。
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

          {/* 不在页面上公开初始凭据：默认账号由部署方在初始化数据时提供。 */}
          <div className="mt-6 rounded-xl border border-line bg-sunken px-3.5 py-3 text-[11.5px] leading-relaxed text-muted">
            <div className="font-medium text-ink-soft">首次登录</div>
            <div className="mt-1">
              初始账号由部署方在初始化数据时提供，请勿在公开界面展示或长期沿用默认口令。
              登录后可见的菜单、角色与权限完全由当前账号的授权决定；若还没有可用菜单，请联系管理员配置。
              首次登录后请立即到个人中心修改口令。
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
