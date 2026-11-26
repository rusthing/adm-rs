# adm-web 视觉区分与布局设计规范（Phase 2）

> 面向 prototype-builder 的可落地规范。所有 class 片段可直接粘贴；令牌需按「三处同步」写入。
> 设计基因：沿用现有 **Data-Dense Dashboard**（≈ Modern Minimal × Tech Utility 的亮色版），只做层次增强，不更换系统、不推翻令牌、不改变字号/密度。

---

## 0. 设计基因与现状结论

- 现有令牌已成型（`styles.css` 的 `@theme` 与 `.adm-federated`，暗色在 `federation.css` 的 `.adm-federated[data-theme='dark']`），本次**只在其上增量新增 4 个令牌**，不改动已有色值。
- 组件 API 保持不变：`Checkbox` 已支持 `indeterminate`、`Badge` 已有 `neutral/success/warn/danger/info/violet`、`Button` 有 `primary/secondary/ghost/danger`。规范只组合现有能力。
- 核心矛盾：分组行与权限叶子行当前几乎同构（同底色透明、同 hover、相近字号字色），用户看不到层级。**解决思路是「用层次而非堆砌来区分」**——给容器层加一个淡底 + 字重 + 图标 + 引导线，叶子层保持轻量，两者差异一眼可辨，同时不增加任何行的高度。

---

## 1. 设计原则（5 条）

1. **层次优先于装饰（Hierarchy over decoration）**：区分层级靠"底色 + 字重 + 图标 + 缩进"的结构差，不靠加边框、加阴影、加颜色种类。视觉噪音零增长。
2. **一个语义一个信号，可叠加不过度**：容器=「淡底 + 半粗字 + Folder 图标 + 左引导线」；叶子=「透明底 + 常规字 + Leaf 图标」。每组信号只表达"我是容器/我是叶子"这一件事。
3. **密度守恒**：字号维持 11–13px，行高、padding、圆角（面板 14 / 卡片 12 / 控件 8）全部不动。区分度提升不牺牲信息密度。
4. **状态正交**：层级编码（容器/叶子）与勾选态（全选/半选/未选）、启用态（停用）、激活态（当前选中分组）各自独立编码，互不覆盖、互不歧义。
5. **可访问性是底线**：所有承载信息的文字 ≥ 4.5:1；焦点环、键盘顺序、reduced-motion、无 emoji 全部保持或增强。

---

## 2. 新增 / 复用设计令牌

### 2.1 新增令牌（4 个）

> **三处同步**：① `styles.css` 的 `@theme`；② `styles.css` 的 `.adm-federated`；③ `federation.css` 的 `.adm-federated[data-theme='dark']`（只写暗色值）。漏写②联邦下失效，漏写③切暗色失效。

| 令牌 | 亮色 HEX | 暗色 HEX | 用途 | 对比度校验 |
|------|----------|----------|------|-----------|
| `--color-group-head` | `#f1f4f9` | `#282f3a` | 分组容器行/分组头的**常驻淡底**，区分于透明底的叶子行 | ink `#191c21` on `#f1f4f9` ≈ **15.4:1** ✓；暗色 ink `#eef0f2` on `#282f3a` ≈ **11.8:1** ✓ |
| `--color-guide` | `#d6dbe3` | `#3b424c` | 层级引导竖线（分组左竖条、树/scope 缩进线） | 装饰性，非信息唯一载体（与底色+字重配合），不强制 4.5:1 |
| `--color-focus` | `#1f4f9e` | `#7fa8f5` | 焦点环色（把现有硬编码 `rgb(31 79 158 / 55%)` 语义化） | on canvas `#f4f5f7` ≈ **7.1:1** ✓（UI 焦点要求 ≥3:1） |
| `--color-row-hover` | `#eef2f8` | `#2b323d` | 表格行/列表行 hover 底色（比 `sunken` 略强，反馈更明确） | 非文本，配合 ink-soft 文字仍 >7:1 ✓ |

**写入 snippet：**

```css
/* styles.css → @theme 与 .adm-federated 两处都加 */
--color-group-head: #f1f4f9;
--color-guide: #d6dbe3;
--color-focus: #1f4f9e;
--color-row-hover: #eef2f8;

/* federation.css → .adm-federated[data-theme='dark'] 内 */
--color-group-head: #282f3a;
--color-guide: #3b424c;
--color-focus: #7fa8f5;
--color-row-hover: #2b323d;
```

焦点环改为引用令牌（两处：styles.css `:focus-visible` 用亮色令牌，暗色靠 federation 覆盖变量）：

```css
.adm-federated :focus-visible {
  outline: 2px solid color-mix(in srgb, var(--color-focus) 62%, transparent);
  outline-offset: 2px;
}
```

### 2.2 复用令牌（明确"复用 X"，不新增）

| 需求 | 复用令牌 | 说明 |
|------|----------|------|
| 分组激活态底色 | `accent-soft` | 现有 `#eaf0fb` / 暗 `#1c2c4a`，配 `accent-strong` 文字 |
| 分组激活态文字/图标 | `accent-strong` / `accent` | 亮 `#143a7a`/`#1f4f9e`；暗 `#a9c6ff`/`#7fa8f5` |
| 分层细线、卡片描边 | `line` | `#e3e6eb` / 暗 `#343a41` |
| 强调分隔线（表头下沿） | `line-strong` | `#cbd1da` / 暗 `#4a525c` |
| 正文/分组名 | `ink` | 亮 `#191c21` / 暗 `#eef0f2` |
| 次正文/叶子名（替代旧的 `text-muted`） | `ink-soft` | 亮 `#4a505a` / 暗 `#c3c9d0` |
| 停用态 | `warn` + `warn-soft`（Badge tone="warn"） | 亮 `#a2670a` on `#fbf1e0` ≈ 4.55:1 ✓ |
| 卡片阴影/浮动 | `shadow-panel` / `shadow-float` | 保持不变 |

### 2.3 对比度修正清单（重要）

现状有 3 处文字用 `text-muted`（#7c828d）压在浅底上，实测 **≈3.8:1 未达 AA**，本次顺手修正：

| 位置 | 现状 | 改为 | 修正后对比度 |
|------|------|------|-------------|
| 表格 `th`（CrudPage.tsx 多处） | `text-muted` on `bg-sunken` ≈ 3.8:1 ✗ | `text-ink-soft` | ≈ **7.9:1** ✓ |
| 分组计数 `count/total`（linked-group.tsx L196） | `text-muted/70` ≈ 2.6:1 ✗ | `text-ink-soft` + `font-mono` | ≈ **7.9:1** ✓ |
| GroupHeader 标签（tree.tsx L242） | `text-muted` on white ≈ 3.9:1 ✗ | `text-ink-soft` | ≈ **8.1:1** ✓ |

> `text-muted` 保留用于非信息性提示（占位符、hint 脚注、treeCode），这些场景不作为正文阅读。

---

## 3. 权限分组 vs 权限点 区分规范（核心）

### 3.1 视觉编码总表

| 维度 | 分组容器（Group） | 权限叶子（Item） |
|------|------------------|-----------------|
| 图标 | `Folder` / `FolderOpen`（随展开切换） | `KeyRound`（权限）/ `CornerDownRight`（通用叶子） |
| 图标色 | `accent`（激活/顶层），否则 `ink-soft` | `muted` |
| 字重 | `font-semibold` | `font-normal` |
| 字色 | `ink`（12.5px） | `ink-soft`（12.5px） |
| 底色 | 常驻 `bg-group-head` | 透明，仅 hover |
| 左引导线 | `border-l-2 border-guide`（顶层 `border-accent/70`） | 无（靠缩进 + Leaf 图标表达归属） |
| 徽标 | 右侧计数 `count/total`（mono）；可选 `Badge neutral`「分组」 | 无（停用态用 `Badge warn`） |
| 缩进 | `paddingLeft = 6 + depth*16` | 相对父分组再 +12~16px |
| 勾选 | 三态 Checkbox（checked/indeterminate） | 单态 Checkbox |

### 3.2 分组行配方（右栏容器内，linked-group.tsx `groupRow` 的 `navigable=false` 分支）

**改造 L150–156 的行容器 div：**

```jsx
<div
  className={cn(
    "flex min-w-0 items-center gap-1.5 rounded-lg py-1.5 pr-2 transition-colors hover:bg-row-hover",
    // 分组容器专属：常驻淡底 + 左引导线（叶子行没有这两个）
    "border-l-2 border-guide bg-group-head",
    depth === 0 && "border-accent/70",
    navigable && activeGroupId === node.id && "border-l-accent bg-accent-soft",
  )}
  style={{ paddingLeft: `${6 + depth * 16}px` }}
>
```

**改造 L194–199 的内容 span（分组名 + 徽标 + 计数）：**

```jsx
<span className="flex min-w-0 flex-1 items-center gap-1.5 text-[12.5px] font-semibold text-ink">
  {open ? <FolderOpen size={13} className="shrink-0 text-accent" />
        : <Folder size={13} className="shrink-0 text-accent" />}
  <span className="truncate">{node.name}</span>
  {!node.enabled && <Badge tone="warn">停用</Badge>}
  <span className="ml-auto shrink-0 font-mono text-[10.5px] text-ink-soft">
    {state.count}/{ids.length}
  </span>
</span>
```

> 左栏（`navigable=true`）分组名保留现有 `font-medium text-accent-strong` 激活态即可；仅把 `text-[12px]` 统一为 `text-[12.5px]`，并在名称前加 `Folder/FolderOpen`，与右栏语义一致。

### 3.3 权限叶子行配方（linked-group.tsx `itemRows` L210–218）

```jsx
<label className="flex items-start gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-row-hover">
  <Checkbox checked={selectedIds.has(item.id)} onChange={() => onToggle(item.id)} label={undefined} />
  <CornerDownRight size={12} className="mt-0.5 shrink-0 text-muted" aria-hidden />
  <span className="min-w-0 flex-1 text-[12.5px] font-normal text-ink-soft">{renderItem(item)}</span>
</label>
```

> `renderItem` 返回的内容里若含 `!enabled`，统一用 `<Badge tone="warn">停用</Badge>` 替代裸 `text-warn` 小字（RolesPage.tsx L158 同样替换）。

### 3.4 tree.tsx 的层级映射（PermCheckList / MenuCheckList / GroupHeader / TreeCheckboxGroup）

同一套语义应用到三处既有结构，只需**增强 class，不改结构**：

| 结构 | 位置 | 增强 |
|------|------|------|
| 主体段（最大分组） | `PermCheckList` L373 `bg-sunken/70` | 改 `bg-group-head border-l-2 border-guide`；名称加 `font-semibold text-ink`；chevrn 旁加 `FolderOpen`，左侧 `text-accent`；计数 `text-ink-soft` |
| 类型头（二级分组） | `GroupHeader` L233–247 | 保留 `border-b border-line/70`；标签 `text-muted`→`text-ink-soft font-medium`；加 `Folder size={12} text-muted`；计数 `text-ink-soft` |
| 权限叶子 | `PermCheckList` L420–435 | 加 `CornerDownRight`，名称保持 `text-ink-soft font-normal`；hover 用 `bg-row-hover`；停用 `Badge warn` |
| 菜单树节点 | `TreeCheckboxGroup` `TreeRow` L131 | `FolderTree` 顶层 `text-accent`、子级 `text-guide`；叶子（children=0）用 `KeyRound` 替代 FolderTree；分组名 `font-semibold text-ink`、叶子 `font-normal text-ink-soft`；hover `bg-row-hover` |

### 3.5 三态 / 停用 / 半选 / 激活 的表达（确保不丢失）

- **三态勾选**：分组 Checkbox 继续传 `checked` + `indeterminate`（由 `checkState`/`flattenTreeIds` 推导，逻辑不动）；半选时右侧 `count/total` 显示 `0<count<total` 的分数，双通道表达。
- **停用态**：分组与叶子都用 `<Badge tone="warn">停用</Badge>`，保证同构；Checkbox 不禁用（停用仍可被授权是既有业务语义，不改）。
- **激活态**（左栏点击切换右栏范围）：仅左栏分组用 `bg-accent-soft + text-accent-strong + border-l-accent`；右栏分组是勾选容器，不参与"激活"编码，避免语义冲突。
- **不可勾选空分组**：现有 `disabled={ids.length===0}` 保持，行仍显示 `0/0`，符合正交原则。

### 3.6 需新增的 import（lucide）

```ts
// linked-group.tsx
import { ChevronDown, ChevronRight, Layers3, ListChecks, Folder, FolderOpen, CornerDownRight } from "lucide-react";
// tree.tsx
import { ChevronDown, ChevronRight, FolderTree, Folder, FolderOpen, CornerDownRight, KeyRound } from "lucide-react";
```

---

## 4. 列表页高度撑满布局规范

### 4.1 高度链全景（起点在不同环境不同，但改造只在 AppShell 内部，联邦安全）

```
独立站: html:has(#root.adm-federated) / body / #root.adm-federated { height:100% }   ← styles.css 已有
联邦站:  宿主窗口内容区 → div.adm-federated { height:100%; min-height:100% }        ← federation.css 已有
                                  ↓ (两者共同)
AppShell 根        div.flex.h-full.min-h-0
  右列             div.flex.h-full.min-h-0.min-w-0.flex-1.flex-col
    header         header.h-[58px].shrink-0
    内容区          div.flex.min-h-0.flex-1.flex-col.overflow-y-auto   ← 加 flex flex-col（滚动仍兜底）
      main         main.mx-auto.flex.min-h-0.w-full.max-w-[1680px].flex-1.flex-col.px-4.py-5  ← 加 flex min-h-0 flex-1 flex-col
        Outlet → CrudPage 根
          div.flex.min-h-0.flex-1.flex-col                  ← 原普通 div，改满高 flex 列
            PageHeader（自然高，shrink-0）
            tabs（自然高，shrink-0）
            主体  div.flex.min-h-0.flex-1.flex-col.gap-4 (lg:flex-row)  ← 加 min-h-0 flex-1；去掉 lg:items-start
              ScopePanel / sidePanel（lg:w-[224px]，stretch 满高）
              卡片 section.flex.min-h-0.flex-1.flex-col.overflow-hidden.rounded-[14px]...  ← 加 flex min-h-0 flex-col
                搜索栏 div.shrink-0.border-b...             ← 加 shrink-0
                表格区 div.min-h-0.flex-1.overflow-auto      ← 原 overflow-x-auto，改纵向也滚
                  table > thead th.sticky.top-0.z-10（首列 z-20）+ tbody
                Pagination.shrink-0.border-t               ← 加 shrink-0
            Modal / Drawer（Portal，不占高度链）
      footer（自然高）
```

> 每一层的两个关键词：**`flex-1`（吃掉剩余高度）** 与 **`min-h-0`（打破 flex item 最小内容高度，使 overflow 生效）**。链上任何一层缺 `min-h-0`，内部滚动就会失效并回退成整页滚动。

### 4.2 逐层改动清单（prototype-builder 直接改）

| 文件 | 位置 | 现状 class | 改为 |
|------|------|-----------|------|
| `AppShell.tsx` | L616 内容区 | `min-h-0 flex-1 overflow-y-auto` | `flex min-h-0 flex-1 flex-col overflow-y-auto` |
| `AppShell.tsx` | L638 main | `mx-auto w-full max-w-[1680px] px-4 py-5 sm:px-6` | `mx-auto flex min-h-0 w-full max-w-[1680px] flex-1 flex-col px-4 py-5 sm:px-6` |
| `CrudPage.tsx` | L1046 根 div | `<div>` | `<div className="flex min-h-0 flex-1 flex-col">` |
| `CrudPage.tsx` | L1108 主体 div | `flex min-w-0 flex-col gap-4` + `lg:flex-row lg:items-start` | `flex min-h-0 min-w-0 flex-1 flex-col gap-4` + `lg:flex-row`（**删掉 `lg:items-start`**，改默认 stretch 让卡片满高） |
| `CrudPage.tsx` | L1118 卡片 section | `min-w-0 flex-1 overflow-hidden rounded-[14px] border border-line bg-surface shadow-panel` | 前置 `flex min-h-0 flex-col`，其余保留 |
| `CrudPage.tsx` | L1122 搜索栏 | `flex items-center gap-2 overflow-x-auto border-b border-line px-3 py-2.5` | 前置 `shrink-0` |
| `CrudPage.tsx` | L1228 表格容器 | `overflow-x-auto` | `min-h-0 flex-1 overflow-auto`（横纵都滚） |
| `CrudPage.tsx` | L1231/1245/1255 各 `th` | `... bg-sunken px-3 py-2 ... text-[11.5px] font-medium text-muted` | 加 `sticky top-0 z-10 bg-sunken`；`text-muted`→`text-ink-soft font-semibold text-[11px]` |
| `CrudPage.tsx` | L1235 排序 th / L1248 首列 th | `sticky left-0 z-10 ... bg-sunken` | z 提到 `z-20`（同时 sticky top + left），保留 bg |
| `CrudPage.tsx` | L758 排序 td / L1280 首列 td | `sticky left-0 z-10 ... bg-surface ... group-hover:bg-sunken/50` | hover 改 `group-hover:bg-row-hover`；z 保持 10（td 不需 sticky top） |
| `CrudPage.tsx` | L1267 数据行 tr | `group border-b border-line/80 last:border-b-0 hover:bg-sunken/50` | `hover:bg-row-hover transition-colors duration-150` |
| `CrudPage.tsx` | L1352 Pagination | （组件内部 `border-t`） | 在调用处包一层 `<div className="shrink-0">`，或给 Pagination 根加 `shrink-0`（改 primitives.tsx L325） |

### 4.3 两种数据状态表现

- **数据多**：卡片撑满内容区，表格区 `flex-1 overflow-auto` 内部纵向滚动；`thead` sticky 固定；分页固定在卡片底部；页面头部、顶栏、footer、侧栏都不动。
- **数据少**：表格区仍占满卡片剩余高度，留白落在卡片内部（surface 白底，干净稳定），不会随数据量抖动成"矮卡片 + 大片 canvas 空白"；sticky 表头与固定分页保持位置不变。
- **空态 / 加载 / 错误态**：这三个分支当前直接替换表格区。改造后把它们包进表格区槽位 `<div className="min-h-0 flex-1 overflow-auto flex items-center justify-center">`，让 `EmptyState`/`Spinner` 在卡片内垂直居中，分页仍固定底部（分页是否显示由现有逻辑决定）。

### 4.4 联邦环境注意（必须遵守）

- **不要碰 `html` / `body` 的高度**（styles.css 的 `:has(#root.adm-federated)` 规则只服务独立站；联邦窗口里 html/body 是宿主 uiam 的）。本次所有改动都在 `.adm-federated` 内部，天然安全。
- 高度链起点在联邦下是 `div.adm-federated`（`federation.css` 已给 `height:100%; min-height:100%`），AppShell 的 `h-full` 正确落位。若某联邦宿主给的是 `min-height` 而非确定高度，`overflow-auto` 可能退化为内容滚动——**验收时请在联邦窗口实测数据多时的内部滚动**；若退化，需宿主给确定高度，不在 adm 侧 hack。
- 新增令牌的暗色值必须写入 federation.css，否则联邦切暗色时分组淡底/引导线会串成亮色。

---

## 5. 其它区域区分度增强清单（含优先级）

| 优先级 | 区域 | 改造 | 具体配方 |
|--------|------|------|----------|
| **P0** | 表头可读性 | `text-muted` 对比度不足 | `th` 用 `text-ink-soft font-semibold text-[11px]`，底 `bg-sunken`，sticky + `.hairline`（复用现有 utility） |
| **P0** | 行 hover 反馈 | 反馈太弱 | `hover:bg-row-hover transition-colors duration-150`（表格 tr、linked-group 行、scope 项统一） |
| **P0** | 分组 vs 叶子 | 本次核心 | 见第 3 节全套配方 |
| **P1** | 卡片头/体/脚三段 | 层次偏平 | 搜索栏加 `shrink-0 bg-sunken/40`，与表格体、分页形成三段；分页 `shrink-0 border-t` |
| **P1** | scope 面板层级 | 父子同构 | 父节点 `font-semibold text-ink` + `FolderOpen`；叶子 `font-normal text-ink-soft`；激活项加左竖条 `border-l-2 border-accent`；缩进线 `border-guide` |
| **P1** | 停用态统一 | 裸 `text-warn` 不一致 | 全部改 `<Badge tone="warn">停用</Badge>`（linked-group L191、RolesPage L158） |
| **P2** | 斑马纹 | 帮助横向追踪 | 数据行 `even:bg-sunken/40`（很淡）；与 hover 并存时 hover 优先（hover 类写在后面）。**默认关闭**，作为可选项，避免 Data-Dense 下噪点增加 |
| **P2** | 侧栏导航分组头 | 分隔偏弱 | `AppSectionHeader`（AppShell.tsx L139–143）：细线 `bg-line`→`bg-line-strong`，图标 `text-muted`→`text-accent/70`；分组节点 `font-medium`→`font-semibold text-ink-soft`，叶子保持 `font-medium` |
| **P2** | 焦点环令牌化 | 硬编码 | 用 `--color-focus`（第 2.1 节 snippet） |

---

## 6. 可访问性与 Anti-Slop 约束

- **对比度**：承载信息的文字 ≥ 4.5:1（第 2.3 节已给出 3 处修正）；UI 组件边界与焦点环 ≥ 3:1。暗色令牌全部达标。
- **焦点环**：保留 `.adm-federated :focus-visible` 的 2px outline + 2px offset，改为 `var(--color-focus)`；键盘 Tab 顺序不变，`aria-pressed` / `aria-expanded` / `aria-current` / `aria-label` 全部保留。
- **键盘导航**：分组展开按钮、导航按钮、Checkbox 均为原生可聚焦元素；不要把 `<label>` 换成不可聚焦 `<div>`。
- **reduced-motion**：`styles.css` 已有全局 `@media (prefers-reduced-motion: reduce)` 兜底；新增的 `transition-colors duration-150` 会被自动降级，无需额外处理。
- **无 emoji**：所有新增图标只用 lucide SVG（Folder/FolderOpen/KeyRound/CornerDownRight），不引入 emoji。
- **hover 不用 scale / 位移**：只允许 `background-color` / `color` 变化（150ms），禁止 `hover:scale-*`、`hover:-translate-*`、`transform` 动画。
- **信号冗余**：层级不只靠颜色（淡底），同时有字重、图标、缩进、引导线——色觉障碍用户仍可分辨。
- **响应式**：375/768/1024/1440 保持现有断点（`lg:flex-row`、`lg:w-[224px]`、`lg:w-[248px]`）；窄屏双栏继续上下堆叠，满高链在窄屏退化为文档流滚动属预期。

---

## 7. 落地顺序建议（给 prototype-builder）

1. 写令牌（4 个 × 三处）+ 焦点环 snippet + 3 处对比度修正。
2. 改高度链（AppShell → CrudPage → 表格区 → sticky 表头 → 分页），先验收"数据多/数据少/空态"三态与联邦窗口。
3. 改权限区分（linked-group.tsx 分组行 + 叶子行；tree.tsx 三处映射），加 lucide import。
4. 按 P0→P1→P2 补其它区域；P2 斑马纹默认不开。
5. 验收：亮/暗双主题、键盘 Tab + Enter/Space、reduced-motion、联邦窗口实际滚动。
