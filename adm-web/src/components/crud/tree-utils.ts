/**
 * 树形还原的纯逻辑：把平铺列表按 `treeCode` 前缀还原成任意层级树。
 *
 * 与 `./tree.tsx` 的渲染分离，便于直接单测；也不把 React / react-query 拖进测试图。
 */

export interface TreeNode {
  id: string;
  name: string;
  treeCode: string;
  enabled: boolean;
}

export type TreeItem<T> = T & {
  children?: TreeItem<T>[];
  /** 真实展示层级（中间层缺失时不按 treeCode 长度虚增）。 */
  depth?: number;
};

/**
 * `scopeOf` 是关键：菜单 treeCode 只在应用内唯一（分组树脱钩领域后全局唯一，无需隔离）。
 * 不隔离的话同编码节点会互相认父，勾一个应用的节点会串到另一个应用。
 * 函数会 clone 入参，绝不往 React Query 缓存对象上挂 `children`。
 */
export function buildTree<T extends TreeNode>(
  items: T[],
  scopeOf?: (item: T) => string | null | undefined,
): TreeItem<T>[] {
  const clones: TreeItem<T>[] = items.map((item) => ({ ...item }));
  const keyOf = (item: T, code: string) => `${scopeOf?.(item) ?? ""}\u0000${code}`;

  const byCode = new Map<string, TreeItem<T>>();
  for (const item of clones) byCode.set(keyOf(item, item.treeCode), item);

  const roots: TreeItem<T>[] = [];
  const childrenOf = new Map<string, TreeItem<T>[]>();
  for (const item of clones) {
    let code = item.treeCode;
    let parentKey: string | null = null;
    // 逐级上溯到最近的可见祖先：授权过滤后的列表缺中间层是常态。
    while (code.length > 3) {
      code = code.slice(0, -3);
      const candidate = keyOf(item, code);
      if (byCode.has(candidate)) {
        parentKey = candidate;
        break;
      }
    }
    if (parentKey) {
      const siblings = childrenOf.get(parentKey) ?? [];
      siblings.push(item);
      childrenOf.set(parentKey, siblings);
    } else {
      roots.push(item);
    }
  }

  const sortRec = (nodes: TreeItem<T>[], depth: number): TreeItem<T>[] => {
    nodes.sort((a, b) => a.treeCode.localeCompare(b.treeCode) || a.id.localeCompare(b.id));
    for (const node of nodes) {
      node.depth = depth;
      const children = childrenOf.get(keyOf(node, node.treeCode));
      if (children) node.children = sortRec(children, depth + 1);
    }
    return nodes;
  };
  return sortRec(roots, 0);
}

/**
 * 深度优先收集树里所有节点 id。
 *
 * 授权抽屉的「全选本组 / 清空本组」按可见分组批量勾选，而分组渲染的是树，
 * 必须把子孙一起算进去——只勾根节点会让子菜单/子权限漏授权。
 */
export function flattenTreeIds<T extends TreeNode>(items: TreeItem<T>[]): string[] {
  const ids: string[] = [];
  const walk = (nodes: TreeItem<T>[]) => {
    for (const node of nodes) {
      ids.push(node.id);
      if (node.children && node.children.length > 0) walk(node.children);
    }
  };
  walk(items);
  return ids;
}
