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
 * 窗口标题必须报后端的菜单名（不是路径末段），且权限异步返回后要再报一次，
 * 否则 uiam 桌面标题栏会一直显示 `menus` 这类 slug。取名规则见 ./title。
 */
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router-dom";
import { AppRoutes } from "@/App";
import { AuthProvider, useAuth } from "@/auth/AuthContext";
import { ConfirmProvider, ToastProvider } from "@/components/ui/overlay";
import { titleOfPath } from "./title";
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

function RouteReporter({ onRoute }: { onRoute?: AdmFederatedProps["onRoute"] }) {
  const { pathname } = useLocation();
  const { authz } = useAuth();
  // 菜单来自 /adm/auth/me：首帧可能还没有，返回后由 title 的变化再报一次。
  const title = titleOfPath(pathname, authz?.menus ?? []);
  useEffect(() => {
    if (pathname === "/login") return; // 登录页不改窗口标题
    onRoute?.(pathname, title);
  }, [pathname, title, onRoute]);
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
