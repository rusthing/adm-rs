/**
 * 未保存修改的离开保护。
 *
 * 本项目用 BrowserRouter / HashRouter（非 data router），React Router 的
 * `useBlocker` 在这里不可用，因此自己拦两类离开路径：
 *   1. 刷新 / 关闭标签页：`beforeunload`；
 *   2. 站内 `<Link>` 点击：document 捕获阶段拦截，确认后用 `navigate` 跳转。
 * 浏览器前进 / 后退（popstate）无法可靠取消，这里不伪装支持。
 */
import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useConfirm } from "@/components/ui/overlay";

/**
 * 把 `<Link>` 生成的 href 转成可以直接交给 `navigate` 的应用内路径。
 * 返回 null 表示这不是应用内跳转（外链、下载、应用外绝对路径等），不拦。
 */
export function toInternalPath(href: string | null | undefined): string | null {
  if (!href) return null;
  const value = href.trim();
  if (!value || /[\u0000-\u001f\u007f]/.test(value)) return null;

  if (import.meta.env.VITE_ROUTER === "hash") {
    if (!value.startsWith("#")) return null;
    const path = value.slice(1);
    return path.startsWith("/") && !path.startsWith("//") ? path : null;
  }

  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  // BrowserRouter 的 href 带 basename，而 navigate 需要不含 basename 的路径。
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  let path = value;
  if (base) {
    if (value === base) path = "/";
    else if (value.startsWith(`${base}/`)) path = value.slice(base.length);
    else return null;
  }
  return path;
}

export function useUnsavedGuard(
  dirty: boolean,
  message = "当前有未保存的修改，离开后会丢失。确定继续吗？",
): void {
  const navigate = useNavigate();
  const location = useLocation();
  const confirm = useConfirm();
  const leavingRef = useRef(false);
  const currentPath = `${location.pathname}${location.search}${location.hash}`;

  useEffect(() => {
    if (!dirty) {
      leavingRef.current = false;
      return;
    }

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (leavingRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };

    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const to = toInternalPath(anchor.getAttribute("href"));
      // 点当前页的链接不算「离开」，没必要弹确认。
      if (!to || to === currentPath) return;

      // 捕获阶段同时 preventDefault + stopPropagation：React Router 的 Link
      // 监听在 root 容器上，需要先把它挡掉，确认后再显式 navigate。
      event.preventDefault();
      event.stopPropagation();
      void confirm({
        title: "放弃未保存的修改？",
        description: message,
        confirmText: "离开",
        cancelText: "继续编辑",
        tone: "danger",
      }).then((ok) => {
        if (!ok) return;
        leavingRef.current = true;
        navigate(to);
      });
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty, message, confirm, navigate, currentPath]);
}
