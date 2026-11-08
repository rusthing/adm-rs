/**
 * 高危操作的审核口令：统一的输入控件与校验调用。
 *
 * 与 dbz 的删除交互保持一致：弹窗内输入明文 → SM3 → `POST /adm/auth/verify-audit-password`。
 * 审核口令为空时由服务端回退校验登录口令，前端只传一个口令字段、不做任何分支；
 * 服务端在响应里用 `pswdKind` 告知本次实际校验的类型，仅用于提示文案。
 */
import { Field, Input } from "@/components/ui/primitives";
import { authApi } from "@/lib/api";
import { ApiError } from "@/lib/http";
import { sm3 } from "@/lib/sm3";
import type { AdmVerifyAuditPasswordVo } from "@/lib/types";

/** 校验审核口令；失败统一抛 `Error`，`message` 可直接展示给用户。 */
export async function verifyAuditPassword(
  plain: string,
): Promise<AdmVerifyAuditPasswordVo | undefined> {
  const text = plain.trim();
  if (!text) throw new Error("请输入审核口令");
  try {
    return await authApi.verifyAuditPassword(sm3(text));
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    switch (error.code) {
      case "ADM00007":
        // 后端按实际校验的口令类型给出「审核口令不正确」或「登录口令不正确」
        throw error;
      case "ADM00008":
        throw new Error("口令尝试过于频繁，请稍后再试");
      case "ADM00009":
        throw new Error("当前账号不可用，无法完成审核");
      default:
        throw error;
    }
  }
}

export function AuditPasswordField({
  id = "audit-password",
  value,
  onChange,
  error,
  disabled,
  autoFocus,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <Field
      label="审核口令（未设置时使用登录口令）"
      htmlFor={id}
      required
      hint="删除属于高危操作，需输入本人审核口令确认；未设置审核口令时请直接输入登录口令，口令只用于本次校验。"
      error={error}
    >
      <Input
        id={id}
        type="password"
        autoComplete="off"
        autoFocus={autoFocus}
        value={value}
        disabled={disabled}
        placeholder="请输入审核口令（未设置时填登录口令）"
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}
