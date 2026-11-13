import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { ApiError } from "@/lib/http";
import { LoginShell } from "@/login/LoginShell";

const CODE_TEXT: Record<string, string> = {
  ADM00001: "账号或口令不正确。后端对「账号不存在」和「口令错误」使用同一个编码。",
  ADM00002: "账号已被锁定，请稍后再试或让管理员处理。",
  ADM00003: "账号已停用。",
  ADM00004: "账号已过期。",
  ADM00005: "令牌无效（登录阶段一般不会出现）。",
  ADM00006: "该登录标识命中多个账号，请改用登录名。",
};

/**
 * # Adm 登录页
 *
 * 视图统一走 `login/LoginShell`；这里只保留业务错误码翻译、returnUrl 安全校验与跳转。
 */
export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

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

  async function submit(account: string, password: string) {
    try {
      await login(account, password);
    } catch (reason) {
      if (reason instanceof ApiError) {
        throw new Error(reason.code ? CODE_TEXT[reason.code] ?? reason.message : reason.message);
      }
      throw reason instanceof Error ? reason : new Error("登录失败");
    }
    navigate(returnUrl, { replace: true });
  }

  return <LoginShell brand="adm" onSubmit={submit} />;
}
