import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
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
            <span className="flex-1 text-[12.5px] leading-relaxed text-ink-soft">{item.message}</span>
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

function useOverlay(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = "max-w-[640px]",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  useOverlay(open, onClose);
  if (!open) return null;

  return (
    <div className="animate-fade fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-ink/35 px-4 py-10">
      <div
        className={cn("animate-rise w-full rounded-[14px] border border-line bg-surface shadow-float", width)}
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            <h2 className="text-[14px] font-semibold text-ink">{title}</h2>
            {description && <p className="mt-0.5 text-[11.5px] text-muted">{description}</p>}
          </div>
          <button type="button" className="text-muted hover:text-ink" onClick={onClose} aria-label="关闭">
            <X size={17} />
          </button>
        </header>
        <div className="max-h-[70vh] overflow-y-auto px-4 py-4">{children}</div>
        {footer && (
          <footer className="flex items-center justify-end gap-2 border-t border-line px-4 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = "w-full max-w-[560px]",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  useOverlay(open, onClose);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-ink/35" onClick={onClose}>
      <div
        className={cn(
          "animate-slide-left ml-auto flex h-full flex-col border-l border-line bg-surface shadow-float",
          width,
        )}
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            <h2 className="text-[14px] font-semibold text-ink">{title}</h2>
            {description && <p className="mt-0.5 text-[11.5px] text-muted">{description}</p>}
          </div>
          <button type="button" className="text-muted hover:text-ink" onClick={onClose} aria-label="关闭">
            <X size={17} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer && (
          <footer className="flex items-center justify-end gap-2 border-t border-line px-4 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
