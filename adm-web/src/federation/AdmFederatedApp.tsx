/**
 * 联邦入口：给 uiam 桌面用的页面级模块。
 *
 * adm 独立入口的 Provider 树（QueryClient/Auth/Toast/Confirm）都在 main.tsx，
 * 这里原样重建一遍，只把 BrowserRouter 换成 MemoryRouter——路由被关在窗口内部，
 * 不碰宿主地址栏。AppRoutes 与独立入口共用，菜单渲染逻辑只有一份。
 *
 * 主题通过 props 传入：React 单例后 props 是最可靠的通道，宿主从 light 切到
 * dark 时这里直接重渲染根节点的 data-theme。
 *
 * adm 的菜单是后端动态下发的，没有静态路由表可映射到标题；这里用 pathname
 * 做兜底（末段转可读文案），拿到具体菜单名的深链由宿主窗口保持默认标题。
 */
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router-dom";
import { AppRoutes } from "@/App";
import { AuthProvider } from "@/auth/AuthContext";
import { ConfirmProvider, ToastProvider } from "@/components/ui/overlay";
import "@/styles.css";
import "./federation.css";

export interface AdmFederatedProps {
  theme?: "light" | "dark";
  initialPath?: string;
  onRoute?: (path: string, title: string) => void;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 10_000, refetchOnWindowFocus: false },
  },
});

/** 常见静态路径的可读名；动态菜单路径回退到末段，仍是稳定可复现的标题。 */
const PATH_TITLES: Record<string, string> = {
  "/": "后台管理",
  "/dashboard": "后台管理",
  "/login": "登录",
  "/profile": "个人资料",
};

function titleOf(pathname: string): string {
  if (PATH_TITLES[pathname]) return PATH_TITLES[pathname];
  const last = pathname.split("/").filter(Boolean).pop();
  return last ? `${last}` : "后台管理";
}

function RouteReporter({ onRoute }: { onRoute?: AdmFederatedProps["onRoute"] }) {
  const { pathname } = useLocation();
  useEffect(() => {
    if (pathname === "/login") return; // 登录页不改窗口标题
    onRoute?.(pathname, titleOf(pathname));
  }, [pathname, onRoute]);
  return null;
}

export default function AdmFederatedApp({
  theme = "light",
  initialPath = "/",
  onRoute,
}: AdmFederatedProps) {
  const entry = initialPath.startsWith("/") ? initialPath : "/";
  return (
    <div className="adm-federated" data-theme={theme}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[entry]}>
          <AuthProvider>
            <ToastProvider>
              <ConfirmProvider>
                <RouteReporter onRoute={onRoute} />
                <AppRoutes />
              </ConfirmProvider>
            </ToastProvider>
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </div>
  );
}
