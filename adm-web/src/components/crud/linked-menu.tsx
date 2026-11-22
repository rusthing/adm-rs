/**
 * 角色菜单抽屉的「应用 ↔ 菜单树」双栏联动。
 *
 * 与 `LinkedGroupSelector` 同一套视觉与勾选语义：左栏应用可整组勾选，
 * 点应用名切换右栏；右栏只显示该应用的菜单树，父子级联勾选。两栏高度撑满。
 */
import { useMemo } from "react";
import type { AdmAppVo, AdmMenuVo } from "@/lib/types";
import { Checkbox } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { Layers3, ListTree } from "lucide-react";
import { TreeCheckboxGroup } from "./tree";
import { buildTree } from "./tree-utils";

export function LinkedMenuSelector({
  apps,
  menus,
  activeApp,
  onSelectApp,
  selected,
  onToggle,
  onSetMany,
}: {
  apps: AdmAppVo[];
  menus: AdmMenuVo[];
  activeApp: string | null;
  onSelectApp: (appId: string) => void;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onSetMany: (ids: string[], checked: boolean) => void;
}) {
  const menusByApp = useMemo(() => {
    const map = new Map<string, AdmMenuVo[]>();
    for (const menu of menus) {
      const list = map.get(menu.appId) ?? [];
      list.push(menu);
      map.set(menu.appId, list);
    }
    return map;
  }, [menus]);

  const tree = useMemo(
    () => (activeApp ? buildTree(menusByApp.get(activeApp) ?? [], (menu) => menu.appId) : []),
    [activeApp, menusByApp],
  );
  const active = apps.find((app) => app.id === activeApp);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
      <aside className="flex w-full flex-col overflow-hidden rounded-xl border border-line bg-surface lg:w-[220px] lg:shrink-0">
        <div className="flex shrink-0 items-center gap-1.5 border-b border-line px-3 py-2 text-[12.5px] font-semibold text-ink">
          <Layers3 size={13} className="text-muted" /> 应用
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {apps.length === 0 ? (
            <p className="px-2 py-4 text-[11.5px] text-muted">还没有应用。</p>
          ) : (
            <div className="flex flex-col gap-0.5">
              {apps.map((app) => {
                const ids = (menusByApp.get(app.id) ?? []).map((menu) => menu.id);
                const count = ids.reduce((sum, id) => sum + (selected.has(id) ? 1 : 0), 0);
                const checked = ids.length > 0 && count === ids.length;
                const isActive = activeApp === app.id;
                return (
                  <div
                    key={app.id}
                    className={cn(
                      "flex min-w-0 items-center gap-2 rounded-lg py-1.5 pl-2 pr-1.5",
                      isActive && "bg-accent-soft",
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      indeterminate={count > 0 && count < ids.length}
                      onChange={(next) => onSetMany(ids, next)}
                      label={undefined}
                      disabled={ids.length === 0}
                    />
                    <button
                      type="button"
                      onClick={() => onSelectApp(app.id)}
                      aria-pressed={isActive}
                      className={cn(
                        "flex min-w-0 flex-1 items-center gap-1.5 text-left text-[12.5px]",
                        isActive ? "font-medium text-accent-strong" : "text-ink-soft hover:text-ink",
                      )}
                    >
                      <span className="truncate">{app.name}</span>
                      {!app.enabled && <span className="shrink-0 text-[10px] text-warn">停用</span>}
                      <span className="ml-auto shrink-0 text-[10.5px] text-muted/70">
                        {count}/{ids.length}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="shrink-0 border-t border-line px-3 py-2 text-[11px] leading-relaxed text-muted">
          勾选应用即全选该应用下所有菜单；点名称只切换右栏。
        </div>
      </aside>
      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-line bg-surface">
        <div className="flex shrink-0 items-center gap-1.5 border-b border-line px-3 py-2 text-[12.5px] font-semibold text-ink">
          <ListTree size={13} className="text-muted" /> 菜单
          {active && <span className="ml-auto text-[11px] font-normal text-muted">{active.name}</span>}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {tree.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line px-3 py-8 text-center text-[12px] text-muted">
              该应用下暂无菜单。
            </p>
          ) : (
            <TreeCheckboxGroup
              key={activeApp ?? ""}
              items={tree}
              selected={selected}
              onToggle={onToggle}
              onSetMany={onSetMany}
            />
          )}
        </div>
        <div className="shrink-0 border-t border-line px-3 py-2 text-[11px] leading-relaxed text-muted">
          菜单树按父子级联勾选；勾选父节点会带上全部子孙。
        </div>
      </section>
    </div>
  );
}
