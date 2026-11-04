/**
 * 权限 URN 前缀匹配，必须落在路径段边界上。
 *
 * 不能直接用 `startsWith`：`GET:/adm/role` 会误命中 `GET:/adm/role-group`、
 * `GET:/adm/role-user` 等相邻实体。规则为完全相等，或前缀后紧跟 `/`。
 * 例如 `GET:/adm/user` 可以命中 `GET:/adm/user/page`，但不会命中 `/adm/user-cog`。
 */
export function matchPermUrn(permUrns: string[], urnPrefix: string): boolean {
  const prefix = urnPrefix.trim().toLowerCase().replace(/\/+$/, "");
  if (!prefix) return false;
  return permUrns.some((urn) => {
    const value = urn.trim().toLowerCase();
    return value === prefix || value.startsWith(`${prefix}/`);
  });
}
