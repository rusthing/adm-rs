import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode, RefObject } from "react";
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

const MIN_PANEL_WIDTH = 320;
const MIN_PANEL_HEIGHT = 220;
const VIEWPORT_MARGIN = 16;

type ResizeEdge = "n" | "s" | "e" | "w" | "nw" | "ne" | "sw" | "se";

/** 四边 + 四角，触控用 touch-none 防止浏览器把手势当成滚动。 */
const RESIZE_HANDLES: Array<{ edge: ResizeEdge; className: string }> = [
  { edge: "n", className: "-top-1 left-3 right-3 h-2 cursor-n-resize" },
  { edge: "s", className: "-bottom-1 left-3 right-3 h-2 cursor-s-resize" },
  { edge: "w", className: "-left-1 bottom-3 top-3 w-2 cursor-w-resize" },
  { edge: "e", className: "-right-1 bottom-3 top-3 w-2 cursor-e-resize" },
  { edge: "nw", className: "-left-1 -top-1 h-3 w-3 cursor-nwse-resize" },
  { edge: "ne", className: "-right-1 -top-1 h-3 w-3 cursor-nesw-resize" },
  { edge: "sw", className: "-bottom-1 -left-1 h-3 w-3 cursor-nesw-resize" },
  { edge: "se", className: "-bottom-1 -right-1 h-3 w-3 cursor-nwse-resize" },
];

/**
 * 弹窗的拖动 / 缩放。
 *
 * 拖动只改 `translate`，缩放改 `width/height`；两者都写进 inline style，
 * 所以面板上不能再挂带 transform 的入场动画（animate-rise / animate-slide-left），
 * 否则 `animation-fill-mode: both` 会把 inline transform 覆盖掉。改用只动透明度的
 * animate-fade，遮罩层负责整体淡入。
 *
 * 指针监听器挂在 window 上并在抬起时移除；即使指针移出面板也能继续拖动 / 缩放。
 */
function useMovablePanel(open: boolean, panelRef: RefObject<HTMLDivElement | null>) {
  const offsetRef = useRef({ x: 0, y: 0 });
  const sizeRef = useRef<{ width: number; height: number } | null>(null);
  const [style, setStyle] = useState<CSSProperties>({});

  const apply = useCallback(() => {
    const { x, y } = offsetRef.current;
    const size = sizeRef.current;
    setStyle({
      transform: `translate3d(${x}px, ${y}px, 0)`,
      ...(size
        ? { width: size.width, height: size.height, maxWidth: "none", maxHeight: "none" }
        : {}),
    });
  }, []);

  // 每次重新打开都回到初始位置与尺寸，不沿用上一次拖动的结果。
  useEffect(() => {
    if (!open) return;
    offsetRef.current = { x: 0, y: 0 };
    sizeRef.current = null;
    setStyle({});
  }, [open]);

  const begin = useCallback(
    (event: ReactPointerEvent<HTMLElement>, mode: "move" | ResizeEdge) => {
      // 标题栏里的关闭按钮等交互不能被拖动吞掉。缩放手柄上没有按钮。
      if (mode === "move" && (event.target as HTMLElement).closest("button")) return;
      const rect = panelRef.current?.getBoundingClientRect();
      if (!rect || event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();

      const origin = {
        x: event.clientX,
        y: event.clientY,
        offset: { ...offsetRef.current },
        // 第一次缩放时把当前实际尺寸固化为基准，连续缩放不会累积误差。
        size: sizeRef.current ?? { width: rect.width, height: rect.height },
      };
      const maxWidth = window.innerWidth - VIEWPORT_MARGIN * 2;
      const maxHeight = window.innerHeight - VIEWPORT_MARGIN * 2;
      const clamp = (value: number, min: number, max: number) =>
        Math.min(Math.max(value, min), Math.max(min, max));

      const onMove = (next: PointerEvent) => {
        const dx = next.clientX - origin.x;
        const dy = next.clientY - origin.y;
        if (mode === "move") {
          // 至少留 80px 在视口内，避免把面板整个拖出屏幕找不回来。
          offsetRef.current = {
            x: clamp(origin.offset.x + dx, VIEWPORT_MARGIN - rect.right, window.innerWidth - 80 - rect.left),
            y: clamp(origin.offset.y + dy, VIEWPORT_MARGIN - rect.bottom, window.innerHeight - 60 - rect.top),
          };
        } else {
          const edge = mode as ResizeEdge;
          let width = origin.size.width;
          let height = origin.size.height;
          let x = origin.offset.x;
          let y = origin.offset.y;
          if (edge.includes("e")) width = clamp(origin.size.width + dx, MIN_PANEL_WIDTH, maxWidth);
          if (edge.includes("w")) {
            width = clamp(origin.size.width - dx, MIN_PANEL_WIDTH, maxWidth);
            x = origin.offset.x + (origin.size.width - width);
          }
          if (edge.includes("s")) height = clamp(origin.size.height + dy, MIN_PANEL_HEIGHT, maxHeight);
          if (edge.includes("n")) {
            height = clamp(origin.size.height - dy, MIN_PANEL_HEIGHT, maxHeight);
            y = origin.offset.y + (origin.size.height - height);
          }
          sizeRef.current = { width, height };
          offsetRef.current = { x, y };
        }
        apply();
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [apply, panelRef],
  );

  return { style, begin };
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
  const { style, begin } = useMovablePanel(open, dialogRef);
  const titleId = useId();
  if (!open) return null;
  const resized = style.height !== undefined;

  const panel = (
    <div
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      style={style}
      className={cn(
        "animate-fade relative flex flex-col outline-none",
        variant === "modal"
          ? cn("w-full rounded-[14px] border border-line bg-surface shadow-float", width)
          : cn("ml-auto h-full border-l border-line bg-surface shadow-float", width),
      )}
      onClick={(event) => event.stopPropagation()}
    >
      <header
        onPointerDown={(event) => begin(event, "move")}
        title="按住标题栏可拖动，四边与四角可调整大小"
        className="flex cursor-move select-none items-start justify-between gap-3 border-b border-line px-4 py-3"
      >
        <div className="min-w-0">
          <h2 id={titleId} className="text-[14px] font-semibold text-ink">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-[11.5px] text-muted">{description}</p>}
        </div>
        <button type="button" className="cursor-pointer text-muted hover:text-ink" onClick={onClose} aria-label="关闭">
          <X size={17} />
        </button>
      </header>
      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto px-4 py-4",
          variant === "modal" && !resized && "max-h-[70vh]",
          variant === "drawer" && "flex flex-col",
        )}
      >
        {children}
      </div>
      {footer && (
        <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-line px-4 py-3">{footer}</footer>
      )}
      {RESIZE_HANDLES.map((handle) => (
        <div
          key={handle.edge}
          aria-hidden
          title="拖动调整大小"
          onPointerDown={(event) => begin(event, handle.edge)}
          className={cn("absolute touch-none", handle.className)}
        />
      ))}
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
