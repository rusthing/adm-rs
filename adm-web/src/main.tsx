import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/auth/AuthContext";
import { ConfirmProvider, ToastProvider } from "@/components/ui/overlay";
import { App } from "@/App";
import "./styles.css";

const basename = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";
const useHashRouter = import.meta.env.VITE_ROUTER === "hash";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 10_000,
      refetchOnWindowFocus: false,
    },
  },
});

/** AuthProvider 必须用 useNavigate / useLocation 处理 401，所以放在 Router 内层。 */
const tree = (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <ToastProvider>
        <ConfirmProvider>
          <App />
        </ConfirmProvider>
      </ToastProvider>
    </AuthProvider>
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {useHashRouter ? <HashRouter>{tree}</HashRouter> : <BrowserRouter basename={basename}>{tree}</BrowserRouter>}
  </StrictMode>,
);
