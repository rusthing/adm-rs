import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { menuApi, permGroupApi, roleGroupApi } from "@/lib/api";
import type {
  AdmMenuVo,
  AdmPermGroupVo,
  AdmPermVo,
  AdmRoleGroupVo,
  AdmRoleVo,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge, Checkbox } from "@/components/ui/primitives";
import { FolderTree } from "lucide-react";

/* ------------------------------ tree helpers ------------------------------ */

export interface TreeNode {
  id: string;
  name: string;
  treeCode: string;
  enabled: boolean;
}

export type TreeItem<T> = T & { children?: TreeItem<T>[] };

export function buildTree<T extends TreeNode>(items: T[]): TreeItem<T>[] {
  const byCode = new Map<string, TreeItem<T>>(items.map((item) => [item.treeCode, item]));
  const roots: TreeItem<T>[] = [];
  const childrenOf = new Map<string, TreeItem<T>[]>();
  for (const item of items) {
    const parentCode = item.treeCode.slice(0, -3);
    if (parentCode && byCode.has(parentCode)) {
      const siblings = childrenOf.get(parentCode) ?? [];
      siblings.push(item);
      childrenOf.set(parentCode, siblings);
    } else {
      roots.push(item);
    }
  }
  const sortRec = (nodes: TreeItem<T>[]): TreeItem<T>[] => {
    nodes.sort((a, b) => a.treeCode.localeCompare(b.treeCode));
    for (const node of nodes) {
      const children = childrenOf.get(node.treeCode);
      if (children) node.children = sortRec(children);
    }
    return nodes;
  };
  return sortRec(roots);
}

/* ----------------------------- tree select UI ----------------------------- */

export function TreeCheckboxGroup<T extends TreeNode>({
  items,
  selected,
  onToggle,
  depthIndent = 18,
  checkable = true,
}: {
  items: TreeItem<T>[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  depthIndent?: number;
  checkable?: boolean;
}) {
  return (
    <div className="flex flex-col">
      {items.map((item) => (
        <TreeRow key={item.id} item={item} selected={selected} onToggle={onToggle} depthIndent={depthIndent} checkable={checkable} />
      ))}
    </div>
  );
}

function TreeRow<T extends TreeNode>({
  item,
  selected,
  onToggle,
  depthIndent,
  checkable,
}: {
  item: TreeItem<T>;
  selected: Set<string>;
  onToggle: (id: string) => void;
  depthIndent: number;
  checkable: boolean;
}) {
  const depth = Math.floor(item.treeCode.length / 3) - 1;
  const children = item.children ?? [];
  return (
    <div>
      <div
        className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-sunken"
        style={{ paddingLeft: `${12 + depth * depthIndent}px` }}
      >
        <FolderTree size={14} className={depth === 0 ? "text-accent" : "text-muted/70"} />
        <span className="flex-1 truncate text-[12.5px] text-ink-soft">{item.name}</span>
        {!item.enabled && <Badge tone="warn">停用</Badge>}
        {checkable && (
          <Checkbox
            checked={selected.has(item.id)}
            onChange={() => onToggle(item.id)}
            label={undefined}
          />
        )}
      </div>
      {children.length > 0 && (
        <div>
          {children.map((child) => (
            <TreeRow
              key={child.id}
              item={child}
              selected={selected}
              onToggle={onToggle}
              depthIndent={depthIndent}
              checkable={checkable}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ grouped select ------------------------------ */

export function useGroupedOptions<T extends { groupId: string }>({
  groupApi,
  items,
}: {
  groupApi: "permGroup" | "roleGroup";
  items: T[];
}) {
  const query = useQuery({
    queryKey: [groupApi, "grouped-options"],
    queryFn: () => (groupApi === "permGroup" ? permGroupApi.list() : roleGroupApi.list()),
    staleTime: 30_000,
  });
  const groups = query.data ?? [];
  const grouped = useMemo(() => {
    const byId = new Map<string, AdmPermGroupVo | AdmRoleGroupVo>(groups.map((group) => [group.id, group]));
    const map = new Map<string, { group: AdmPermGroupVo | AdmRoleGroupVo; rows: T[] }>();
    for (const item of items) {
      const group = byId.get(item.groupId);
      if (!group) continue;
      const entry = map.get(item.groupId) ?? { group, rows: [] };
      entry.rows.push(item);
      map.set(item.groupId, entry);
    }
    return Array.from(map.values()).sort((a, b) => a.group.treeCode.localeCompare(b.group.treeCode));
  }, [items, groups]);
  return { groups, grouped, loading: query.isLoading };
}

/* --------------------------- role tree + table --------------------------- */

export function useRoleTree() {
  const query = useQuery({
    queryKey: ["roleGroup", "tree"],
    queryFn: () => roleGroupApi.list(),
    staleTime: 30_000,
  });
  return { groups: query.data ?? [], loading: query.isLoading };
}

export function RoleTable({
  roles,
  selectedId,
  onSelect,
}: {
  roles: AdmRoleVo[];
  selectedId: string | null;
  onSelect: (role: AdmRoleVo) => void;
}) {
  if (roles.length === 0) {
    return (
      <p className="rounded-lg border border-line bg-sunken px-3 py-4 text-center text-[12px] text-muted">
        该分组下还没有角色。
      </p>
    );
  }
  return (
    <table className="w-full border-collapse text-left">
      <thead>
        <tr className="border-b border-line text-[11.5px] text-muted">
          <th className="px-2 py-1.5 font-medium">角色</th>
          <th className="px-2 py-1.5 text-right font-medium">排序</th>
          <th className="px-2 py-1.5 text-right font-medium">状态</th>
        </tr>
      </thead>
      <tbody>
        {roles.map((role) => (
          <tr
            key={role.id}
            onClick={() => onSelect(role)}
            className={cn(
              "cursor-pointer border-b border-line/70 last:border-b-0",
              selectedId === role.id ? "bg-accent-soft" : "hover:bg-sunken",
            )}
          >
            <td className="px-2 py-2 text-[12.5px] text-ink-soft">{role.name}</td>
            <td className="tnum px-2 py-2 text-right text-[12px] text-muted">{role.sortOrder}</td>
            <td className="px-2 py-2 text-right">
              {role.enabled ? <Badge tone="success">启用</Badge> : <Badge tone="warn">停用</Badge>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ------------------------------ perm check list ------------------------------ */

export function PermCheckList({
  perms,
  selected,
  onToggle,
}: {
  perms: AdmPermVo[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  const { grouped } = useGroupedOptions({ groupApi: "permGroup", items: perms });
  if (perms.length === 0)
    return (
      <p className="rounded-lg border border-line bg-sunken px-3 py-4 text-center text-[12px] text-muted">
        还没有权限数据。请先在「权限」里创建。
      </p>
    );
  return (
    <div className="flex flex-col gap-3">
      {grouped.map(({ group, rows }) => (
        <div key={group.id}>
          <div className="mb-1 text-[11.5px] font-medium text-muted">{group.name}</div>
          <div className="flex flex-col gap-0.5">
            {rows.map((perm) => (
              <label key={perm.id} className="flex items-start gap-2 rounded-md px-1.5 py-1 hover:bg-sunken">
                <Checkbox
                  checked={selected.has(perm.id)}
                  onChange={() => onToggle(perm.id)}
                  label={
                    <span className="flex flex-wrap items-baseline gap-x-2 text-[12.5px] text-ink-soft">
                      {perm.name}
                      <code className="font-mono text-[11px] text-muted">{perm.urn}</code>
                      {!perm.enabled && <Badge tone="warn">停用</Badge>}
                    </span>
                  }
                />
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------ menu tree from backend ------------------------------ */

export function useMenuTree() {
  const query = useQuery({
    queryKey: ["menu", "tree"],
    queryFn: () => menuApi.list(),
    staleTime: 30_000,
  });
  return { menus: query.data ?? [], loading: query.isLoading };
}

export function MenuCheckList({
  menus,
  selected,
  onToggle,
}: {
  menus: AdmMenuVo[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  const tree = useMemo(() => buildTree(menus), [menus]);
  if (menus.length === 0)
    return (
      <p className="rounded-lg border border-line bg-sunken px-3 py-4 text-center text-[12px] text-muted">
        还没有菜单数据。请先在「菜单」里创建。
      </p>
    );
  return (
    <div className="max-h-[420px] overflow-y-auto rounded-lg border border-line p-1.5">
      <TreeCheckboxGroup items={tree} selected={selected} onToggle={onToggle} />
    </div>
  );
}
