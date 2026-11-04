import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Inbox, LoaderCircle } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "soft";
type Size = "sm" | "md";

const variantClass: Record<Variant, string> = {
  primary:
    "bg-accent text-white border-transparent hover:bg-accent-strong disabled:bg-accent/50",
  secondary:
    "bg-surface text-ink border-line-strong hover:bg-sunken disabled:text-muted",
  ghost: "bg-transparent text-ink-soft border-transparent hover:bg-sunken",
  danger: "bg-danger text-white border-transparent hover:bg-danger/90 disabled:bg-danger/50",
  soft: "bg-accent-soft text-accent-strong border-transparent hover:bg-[#dde8fa]",
};

const sizeClass: Record<Size, string> = {
  // 行内小按钮保持紧凑，但高度不低于 32px，触摸端更容易点中。
  sm: "h-8 px-2.5 text-[12px] gap-1.5",
  md: "h-9 px-3.5 text-[13px] gap-2",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
}) {
  return (
    <button
      className={cn(
        "inline-flex select-none items-center justify-center rounded-lg border font-medium transition-colors",
        "disabled:cursor-not-allowed",
        variantClass[variant],
        sizeClass[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-9 w-full rounded-lg border border-line-strong bg-surface px-3 text-[13px] text-ink",
        "placeholder:text-muted/70 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15",
        "disabled:cursor-not-allowed disabled:bg-sunken disabled:text-muted",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-[72px] w-full resize-y rounded-lg border border-line-strong bg-surface px-3 py-2 text-[13px] leading-relaxed text-ink",
        "placeholder:text-muted/70 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15",
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-9 w-full appearance-none rounded-lg border border-line-strong bg-surface px-3 text-[13px] text-ink",
        "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <label className={cn("inline-flex items-center gap-2", disabled && "opacity-60")}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors",
          checked ? "border-accent bg-accent" : "border-line-strong bg-[#e9ecf1]",
        )}
      >
        <span
          className={cn(
            "absolute h-4 w-4 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-[17px]" : "translate-x-[2px]",
          )}
        />
      </button>
      {label && <span className="text-[12.5px] text-ink-soft">{label}</span>}
    </label>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className={cn("inline-flex items-start gap-2 text-[13px] text-ink-soft", disabled && "opacity-60")}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[var(--color-accent)]"
      />
      {label}
    </label>
  );
}

export function Field({
  label,
  htmlFor,
  required,
  hint,
  error,
  children,
}: {
  label?: string;
  htmlFor?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={htmlFor} className="text-[12px] font-medium text-ink-soft">
          {label}
          {required && <span className="ml-0.5 text-danger">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className="text-[11.5px] leading-relaxed text-muted">{hint}</p>}
      {error && <p className="text-[11.5px] leading-relaxed text-danger">{error}</p>}
    </div>
  );
}

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "success" | "warn" | "danger" | "info" | "violet";
  children: ReactNode;
}) {
  const tones = {
    neutral: "bg-sunken text-ink-soft border-line",
    success: "bg-success-soft text-success border-transparent",
    warn: "bg-warn-soft text-warn border-transparent",
    danger: "bg-danger-soft text-danger border-transparent",
    info: "bg-info-soft text-info border-transparent",
    violet: "bg-violet-soft text-violet border-transparent",
  }[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4",
        tones,
      )}
    >
      {children}
    </span>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-[14px] border border-line bg-surface shadow-panel",
        className,
      )}
    >
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div className="min-w-0">
            {title && <h2 className="text-[13.5px] font-semibold text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-[11.5px] text-muted">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-[12.5px] text-muted">
      <LoaderCircle size={16} className="animate-spin" />
      {label ?? "加载中…"}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
      <Inbox size={26} className="text-muted/60" />
      <p className="mt-3 text-[13px] font-medium text-ink">{title}</p>
      {description && <p className="mt-1 max-w-md text-[12px] leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[21px] font-semibold leading-tight tracking-[-0.015em] text-ink">
          {title}
        </h1>
        {subtitle && <p className="mt-1 max-w-3xl text-[12.5px] leading-relaxed text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Pagination({
  page,
  size,
  total,
  onChange,
  onSizeChange,
}: {
  page: number;
  size: number;
  total: number;
  onChange: (page: number) => void;
  onSizeChange?: (size: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(page, pages);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-2.5">
      <div className="text-[12px] text-muted">
        第 <span className="tnum text-ink-soft">{current}</span> /{" "}
        <span className="tnum text-ink-soft">{pages}</span> 页 · 共{" "}
        <span className="tnum text-ink-soft">{total}</span> 条
      </div>
      <div className="flex items-center gap-2">
        {onSizeChange && (
          <select
            value={size}
            onChange={(event) => onSizeChange(Number(event.target.value))}
            className="h-7 rounded-md border border-line bg-surface px-1.5 text-[11.5px] text-ink-soft"
          >
            {[10, 20, 50, 100].map((option) => (
              <option key={option} value={option}>
                {option} 条/页
              </option>
            ))}
          </select>
        )}
        <Button size="sm" variant="secondary" disabled={current <= 1} onClick={() => onChange(current - 1)}>
          <ChevronLeft size={14} /> 上一页
        </Button>
        <Button size="sm" variant="secondary" disabled={current >= pages} onClick={() => onChange(current + 1)}>
          下一页 <ChevronRight size={14} />
        </Button>
      </div>
    </div>
  );
}
