import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/primitives";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";

/* ------------------------------- Toast ------------------------------- */

type ToastTone = "success" | "error" | "info";
interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastContextValue {
  push: (message: string, tone?: ToastTone) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);
let toastSeq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((message: string, tone: ToastTone = "info") => {
    toastSeq += 1;
    const id = toastSeq;
    setItems((prev) => [...prev, { id, tone, message }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }, 3600);
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      push,
      success: (message) => push(message, "success"),
      error: (message) => push(message, "error"),
      info: (message) => push(message, "info"),
    }),
    [push],
  );

  const icons = {
    success: <CheckCircle2 size={16} className="text-success" />,
    error: <XCircle size={16} className="text-danger" />,
    info: <Info size={16} className="text-info" />,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[80] flex flex-col items-center gap-2 px-4">
        {items.map((item) => (
          <div
            key={item.id}
            className="animate-rise pointer-events-auto flex w-full max-w-[440px] items-start gap-2 rounded-xl border border-line bg-surface px-3.5 py-2.5 shadow-float"
          >
            {icons[item.tone]}
            <span role="status" className="flex-1 text-[12.5px] leading-relaxed text-ink-soft">
              {item.message}
            </span>
            <button
              type="button"
              className="text-muted hover:text-ink"
              onClick={() => setItems((prev) => prev.filter((entry) => entry.id !== item.id))}
              aria-label="关闭提示"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast 必须在 ToastProvider 内使用");
  return context;
}

/* --------------------------- Overlay helpers --------------------------- */

/**
 * 多个弹层叠加时不能各自保存 / 恢复 body.overflow：
 * 后开的 cleanup 会把先开时存下的 "hidden" 写回去，页面就永久锁死滚动。
 * 这里用引用计数，只在第一个打开时锁、最后一个关闭时恢复。
 */
let overlayCount = 0;
let savedBodyOverflow = "";

function useOverlay(open: boolean, onClose: () => void): RefObject<HTMLDivElement | null> {
  const dialogRef = useRef<HTMLDivElement>(null);
  // 调用方常常传内联箭头；若把 onClose 放进依赖，表单每敲一个字都会重跑
  // effect 并把焦点抢回弹窗。用 ref 保存最新回调，effect 只跟随 open。
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!open) return;

    if (overlayCount === 0) {
      savedBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    overlayCount += 1;

    const previousFocus = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      overlayCount = Math.max(0, overlayCount - 1);
      if (overlayCount === 0) document.body.style.overflow = savedBodyOverflow;
      previousFocus?.focus();
    };
  }, [open]);
  return dialogRef;
}

interface OverlayProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
  /** 点遮罩是否关闭；危险确认 / 有未保存内容的表单应设为 false */
  dismissable?: boolean;
}

function DialogFrame({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width,
  dismissable = true,
  variant,
}: OverlayProps & { variant: "modal" | "drawer" }) {
  const dialogRef = useOverlay(open, onClose);
  const titleId = useId();
  if (!open) return null;

  const panel = (
    <div
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className={cn(
        "outline-none",
        variant === "modal"
          ? cn("animate-rise w-full rounded-[14px] border border-line bg-surface shadow-float", width)
          : cn("animate-slide-left ml-auto flex h-full flex-col border-l border-line bg-surface shadow-float", width),
      )}
      onClick={(event) => event.stopPropagation()}
    >
      <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <h2 id={titleId} className="text-[14px] font-semibold text-ink">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-[11.5px] text-muted">{description}</p>}
        </div>
        <button type="button" className="text-muted hover:text-ink" onClick={onClose} aria-label="关闭">
          <X size={17} />
        </button>
      </header>
      <div className={variant === "modal" ? "max-h-[70vh] overflow-y-auto px-4 py-4" : "flex-1 overflow-y-auto px-4 py-4"}>
        {children}
      </div>
      {footer && (
        <footer className="flex items-center justify-end gap-2 border-t border-line px-4 py-3">{footer}</footer>
      )}
    </div>
  );

  return variant === "modal" ? (
    <div
      className="animate-fade fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-ink/35 px-4 py-10"
      onClick={dismissable ? onClose : undefined}
    >
      {panel}
    </div>
  ) : (
    <div className="fixed inset-0 z-[60] bg-ink/35" onClick={onClose}>
      {panel}
    </div>
  );
}

export function Modal({
  width = "max-w-[640px]",
  ...props
}: OverlayProps) {
  return <DialogFrame variant="modal" width={width} {...props} />;
}

export function Drawer({
  width = "w-full max-w-[560px]",
  ...props
}: OverlayProps) {
  return <DialogFrame variant="drawer" width={width} {...props} />;
}

/* ------------------------------- Confirm ------------------------------- */

export interface ConfirmOptions {
  title: string;
  description?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  /** 破坏性操作用 danger，普通确认用 primary */
  tone?: "danger" | "primary";
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (confirmed: boolean) => void;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * 全应用统一的确认弹窗，替换 `window.confirm`。
 *
 * 用法：`if (!(await confirm({ title: "删除…", tone: "danger" }))) return;`
 * 同一时刻只允许一个确认框；新的确认会先把旧的按「取消」结算，避免遗留一个
 * 永远不 resolve 的 Promise。
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PendingConfirm | null>(null);
  const pendingRef = useRef<PendingConfirm | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      pendingRef.current?.resolve(false);
      const next: PendingConfirm = { ...options, resolve };
      pendingRef.current = next;
      setState(next);
    });
  }, []);

  const settle = useCallback((confirmed: boolean) => {
    const current = pendingRef.current;
    pendingRef.current = null;
    setState(null);
    current?.resolve(confirmed);
  }, []);

  // Provider 卸载（例如整页刷新前的路由切换）时也要结算，别让调用方挂住。
  useEffect(() => {
    return () => pendingRef.current?.resolve(false);
  }, []);

  const onClose = useCallback(() => settle(false), [settle]);
  const description = typeof state?.description === "string" ? state.description : undefined;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <DialogFrame
        variant="modal"
        open={state !== null}
        onClose={onClose}
        title={state?.title ?? ""}
        description={description}
        width="max-w-[460px]"
        dismissable={false}
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>
              {state?.cancelText ?? "取消"}
            </Button>
            <Button
              variant={state?.tone === "danger" ? "danger" : "primary"}
              onClick={() => settle(true)}
            >
              {state?.confirmText ?? "确定"}
            </Button>
          </>
        }
      >
        {typeof state?.description !== "string" ? (state?.description ?? null) : null}
      </DialogFrame>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const context = useContext(ConfirmContext);
  if (!context) throw new Error("useConfirm 必须在 ConfirmProvider 内使用");
  return context;
}
