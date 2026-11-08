/**
 * 高危操作的审核口令：统一的输入控件与校验调用。
 *
 * 与 dbz 的删除交互保持一致：弹窗内输入明文 → SM3 → `POST /adm/auth/verify-audit-password`。
 * 服务端错误按 `code` 分流，未设置审核口令时直接给出设置指引，
 * 而不是让用户对着一个根本不存在的口令反复尝试。
 */
import { Field, Input } from "@/components/ui/primitives";
import { authApi } from "@/lib/api";
import { ApiError } from "@/lib/http";
import { sm3 } from "@/lib/sm3";

/** 当前账号未设置审核口令（`ADM00010`）。 */
export const AUDIT_NOT_SET_CODE = "ADM00010";

/** 校验审核口令；失败统一抛 `Error`，`message` 可直接展示给用户。 */
export async function verifyAuditPassword(plain: string): Promise<void> {
  const text = plain.trim();
  if (!text) throw new Error("请输入审核口令");
  try {
    await authApi.verifyAuditPassword(sm3(text));
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    switch (error.code) {
      case AUDIT_NOT_SET_CODE:
        throw new Error("当前账号尚未设置审核口令，请先在「用户管理」中为本人设置审核口令");
      case "ADM00007":
        throw new Error("审核口令不正确");
      case "ADM00008":
        throw new Error("审核口令尝试过于频繁，请稍后再试");
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
      label="审核口令"
      htmlFor={id}
      required
      hint="删除属于高危操作，需输入本人审核口令确认；口令只用于本次校验。"
      error={error}
    >
      <Input
        id={id}
        type="password"
        autoComplete="off"
        autoFocus={autoFocus}
        value={value}
        disabled={disabled}
        placeholder="请输入审核口令"
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}
