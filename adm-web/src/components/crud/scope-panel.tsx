import { useMemo, useState } from "react";
import { Badge, Spinner } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, Layers3 } from "lucide-react";
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

  // 分组栏默认全部展开；收起的节点记在本地，切换页面即重置。
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const parentCodes = useMemo(() => {
    const codes = new Set<string>();
    for (const option of scope.options) {
      const code = option.treeCode;
      if (!code) continue;
      // 中间层可能缺失：只要存在更长的编码，就说明当前编码有下层，显示折叠箭头。
      for (let length = code.length - 3; length >= 3; length -= 3) {
        codes.add(code.slice(0, length));
      }
    }
    return codes;
  }, [scope.options]);

  const isHidden = (code?: string) => {
    if (!code) return false;
    for (let length = code.length - 3; length >= 3; length -= 3) {
      if (collapsed.has(code.slice(0, length))) return true;
    }
    return false;
  };

  const toggle = (code: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
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
              if (isHidden(option.treeCode)) return null;
              const active = selected === option.value;
              const code = option.treeCode;
              const isParent = code ? parentCodes.has(code) : false;
              const open = !(code && collapsed.has(code));
              return (
                <div
                  key={option.value}
                  className="flex items-center gap-0.5"
                  style={{ paddingLeft: `${8 + scopeIndent(option) * 14}px` }}
                >
                  {isParent ? (
                    <button
                      type="button"
                      onClick={() => toggle(code!)}
                      aria-label={open ? "收起子分组" : "展开子分组"}
                      aria-expanded={open}
                      className="shrink-0 rounded p-0.5 text-muted hover:text-ink"
                    >
                      {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </button>
                  ) : (
                    <span className="w-[16px] shrink-0" />
                  )}
                  <button
                    type="button"
                    onClick={() => onSelect(option.value)}
                    aria-pressed={active}
                    title={option.description ? `${option.label} · ${option.description}` : option.label}
                    className={cn(
                      "flex min-w-0 flex-1 items-center gap-1.5 rounded-lg py-1.5 pr-2 text-left text-[12.5px] transition-colors",
                      active
                        ? "bg-accent-soft font-medium text-accent-strong"
                        : "text-ink-soft hover:bg-sunken hover:text-ink",
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    {option.disabled && <Badge tone="warn">停用</Badge>}
                    {option.description && (
                      <code className="shrink-0 font-mono text-[10px] text-muted">{option.description}</code>
                    )}
                  </button>
                </div>
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
