import { useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

export interface OptionButtonsOption<T extends string = string> {
  value: T;
  label: string;
  disabled?: boolean;
}

/**
 * 少量选项的选择控件（按钮组）。
 *
 * 规范见 dtw-web/docs/ui-spec.md：固定枚举 2–5 个用按钮组，≥6 仍用下拉；
 * 选中项强调色描边 + 浅强调底，未选中为中性描边；容器 `radiogroup`，每项 `radio`。
 * 窄屏 `flex-wrap` 换行，按钮高度不低于 32px。
 */
export function OptionButtons<T extends string = string>({
  options,
  value,
  onChange,
  ariaLabel,
  disabled = false,
  className,
}: {
  options: OptionButtonsOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  /** 整组只读：保留选中样式，不响应点击与键盘。 */
  disabled?: boolean;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  const move = (delta: number | "home" | "end") => {
    const enabled = options.filter((option) => !option.disabled);
    if (enabled.length === 0) return;
    const currentIndex = enabled.findIndex((option) => option.value === value);
    let nextIndex = currentIndex < 0 ? 0 : currentIndex;
    if (delta === "home") nextIndex = 0;
    else if (delta === "end") nextIndex = enabled.length - 1;
    else nextIndex = (nextIndex + delta + enabled.length) % enabled.length;
    onChange(enabled[nextIndex].value);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      move(1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      move(-1);
    } else if (event.key === "Home") {
      event.preventDefault();
      move("home");
    } else if (event.key === "End") {
      event.preventDefault();
      move("end");
    }
  };

  return (
    <div
      ref={containerRef}
      role="radiogroup"
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      onKeyDown={onKeyDown}
      className={cn("flex flex-wrap gap-1.5", className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        const optionDisabled = disabled || option.disabled;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={optionDisabled}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex h-8 min-h-8 items-center justify-center whitespace-nowrap rounded-md border px-2.5 text-[12.5px] transition-colors",
              "cursor-pointer disabled:cursor-not-allowed",
              active
                ? "border-accent/45 bg-accent-soft font-medium text-accent-strong"
                : "border-line-strong bg-surface text-ink-soft hover:border-line-strong hover:bg-sunken",
              optionDisabled && "cursor-not-allowed opacity-50",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
