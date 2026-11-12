/**
 * 日志类页面里的「用户」单元格。
 *
 * 审计日志表只存 `user_id`，直接摆短 ID 等于没回答「是谁」。这里把登录名放主行、
 * 短 ID 放次行：既认得出人，又能拿着 ID 去别处对账。
 *
 * 账号被物理删除后映射里查不到，显示 `--`——不猜「已删除」，也避免把
 * 「映射还没加载完」误报成「用户不存在」。
 */
import { shortId } from "@/lib/utils";
import { useUserOptions } from "@/lib/queries";

export function UserRef({ userId, name }: { userId?: string; name?: string }) {
  return (
    <span className="inline-flex flex-col leading-tight">
      <span className="text-ink-soft">{name ?? "--"}</span>
      <code className="font-mono text-[10.5px] text-muted">{shortId(userId)}</code>
    </span>
  );
}

/**
 * 一次性取回 userId → 登录名 的查表函数。
 *
 * 返回函数而不是 Map：`user_id` 在 VO 里是可空的，`map.get(undefined)` 过不了
 * 类型检查，让调用点写成 `userName(row.userId)` 最省事。
 */
export function useUserName(): (id?: string) => string | undefined {
  const usersQuery = useUserOptions();
  const names = new Map<string, string>();
  for (const user of usersQuery.data ?? []) names.set(user.id, user.name);
  return (id) => (id ? names.get(id) : undefined);
}
