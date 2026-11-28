import type { AdmMenuVo } from "@/lib/types";

/**
 * 联邦窗口标题的取名规则。
 *
 * 独立站可以从侧栏面包屑看到当前位置，但 uiam 桌面只显示窗口标题；之前用
 * 路径末段兜底会把 `/menus` 直接显示成 `menus`，用户根本认不出是哪个页面。
 * 真实名称在 `/adm/auth/me` 下发的菜单里，这里按最长路径匹配取菜单 name。
 */

/** 内置页面没有后端菜单，走静态表；动态菜单一律以后端 name 为准。 */
const STATIC_TITLES: Record<string, string> = {
  "/": "后台管理",
  "/dashboard": "后台管理",
  "/login": "登录",
  "/profile": "个人资料",
};

function normalizePath(path: string): string {
  if (!path.startsWith("/")) return ""; // 外链不是站内路由
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

function pathMatches(menuPath: string, pathname: string): boolean {
  return menuPath === "/"
    ? pathname === "/"
    : pathname === menuPath || pathname.startsWith(`${menuPath}/`);
}

/** 取窗口标题：静态页 → 菜单真实名称（最长路径匹配）→ 路径末段兜底。 */
export function titleOfPath(pathname: string, menus: AdmMenuVo[] = []): string {
  const normalized = normalizePath(pathname) || "/";
  if (STATIC_TITLES[normalized]) return STATIC_TITLES[normalized];

  let matched: AdmMenuVo | null = null;
  let matchedPath = "";
  for (const menu of menus) {
    // 外链 / iframe 与停用菜单都不是当前窗口里的页面
    if (menu.linkType !== 1 || menu.enabled === false) continue;
    const path = normalizePath(menu.path ?? "");
    if (!path || path === "/") continue;
    if (!pathMatches(path, normalized)) continue;
    if (path.length > matchedPath.length) {
      matched = menu;
      matchedPath = path;
    }
  }
  if (matched) return matched.name;

  return normalized.split("/").filter(Boolean).pop() ?? "后台管理";
}
