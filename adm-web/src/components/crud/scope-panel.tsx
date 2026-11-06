import { Badge, Spinner } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { Layers3 } from "lucide-react";
import { scopeIndent } from "./scope";
import type { CrudScopeDef } from "./scope";

/**
 * 列表页左侧的分组栏（应用 / 权限分组）。
 *
 * 选中项通过 `CrudPage` 的 `scope.param` 变成后端筛选条件，同时预填新建表单的
 * `scope.field`，这样「在某个分组下新增」不再需要用户再选一次。
 */
export function ScopePanel({
  scope,
  selected,
  onSelect,
  className,
}: {
  scope: CrudScopeDef;
  /** null / "" 都表示「全部」；具体值为选中的分组 id。 */
  selected: string | null;
  onSelect: (value: string | null) => void;
  className?: string;
}) {
  const allActive = !selected;
  return (
    <aside
      className={cn("overflow-hidden rounded-[14px] border border-line bg-surface shadow-panel", className)}
      aria-label={scope.title}
    >
      <div className="flex items-center justify-between gap-2 border-b border-line px-3.5 py-2.5">
        <h2 className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink">
          <Layers3 size={13} className="text-muted" /> {scope.title}
        </h2>
        <Badge tone="neutral">{scope.options.length}</Badge>
      </div>

      <div className="max-h-[540px] overflow-y-auto p-1.5">
        <button
          type="button"
          onClick={() => onSelect(null)}
          aria-pressed={allActive}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12.5px] font-medium transition-colors",
            allActive ? "bg-accent-soft text-accent-strong" : "text-ink-soft hover:bg-sunken hover:text-ink",
          )}
        >
          全部
          <span className="ml-auto text-[11px] font-normal text-muted">不限制</span>
        </button>

        {scope.loading ? (
          <Spinner label="分组加载中…" />
        ) : scope.options.length === 0 ? (
          <p className="px-2.5 py-4 text-[11.5px] leading-relaxed text-muted">
            {scope.emptyText ?? "还没有分组，请先创建。"}
          </p>
        ) : (
          <div className="mt-1 flex flex-col gap-0.5">
            {scope.options.map((option) => {
              const active = selected === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onSelect(option.value)}
                  aria-pressed={active}
                  title={option.description ? `${option.label} · ${option.description}` : option.label}
                  className={cn(
                    "flex w-full items-center gap-1.5 rounded-lg py-1.5 pr-2.5 text-left text-[12.5px] transition-colors",
                    active
                      ? "bg-accent-soft font-medium text-accent-strong"
                      : "text-ink-soft hover:bg-sunken hover:text-ink",
                  )}
                  style={{ paddingLeft: `${10 + scopeIndent(option) * 14}px` }}
                >
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  {option.disabled && <Badge tone="warn">停用</Badge>}
                  {option.description && (
                    <code className="shrink-0 font-mono text-[10px] text-muted">{option.description}</code>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-t border-line px-3.5 py-2 text-[11px] leading-relaxed text-muted">
        {scope.hint ?? "选中分组后，列表只显示该分组的数据，新建时也会自动归入该分组。"}
      </div>
    </aside>
  );
}
