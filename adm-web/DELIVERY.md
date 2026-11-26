# adm-web 界面改造 · 交付说明

> Phase 5 导出交付 · 交付达（Jiao）
> 构建基准：React 19 + Vite 7.3.7 + Tailwind 4 + TypeScript · 验证日期 2026-11-26

## 一、改造摘要

1. **列表页高度撑满**：把 `AppShell → main → CrudPage → 卡片 → 表格` 整条链路改为 `flex-1 / min-h-0` 的高度传递，滚动只发生在表格区，页头、工具栏、分页条与站点 footer 常驻不滚动；表头 `sticky top-0`、首列 `sticky left-0` 交叉处 z 层级抬到 `z-20`。
2. **授权框分组与权限视觉区分**：分组/容器行统一使用 `bg-group-head` 淡底 + 左侧强调/引导竖条 + `Folder/FolderOpen` 图标 + 加粗字重，权限叶子行使用 `CornerDownRight` 引导箭头 + 常规字重 + `KeyRound` 图标，两栏与父子层级一眼可辨；「停用」统一为 `Badge tone="warn"`。
3. **整体层次增强**：新增 4 个设计令牌（亮/暗双主题：`--color-group-head` / `--color-guide` / `--color-focus` / `--color-row-hover`），焦点环改用 `color-mix` 跟随主题，分组标题、卡片工具条、侧栏导航分组与计数器的对比度整体上调。

## 二、改动文件清单

> `git diff --stat`：**10 个源码文件，+206 / −124**。任务书列了 9 个核心文件，实际额外含 `UsersPage.tsx`（将「停用」文案统一为 Badge，属同一视觉规范的一致性收尾，改动 1 行）。另有一个未跟踪的 `DESIGN-distinction.md`（设计说明文档，非构建输入，未纳入本次构建验证）。

| 文件 | 改动要点 |
|------|---------|
| `src/components/crud/CrudPage.tsx` | 根容器与内容区改 `flex min-h-0 flex-1 flex-col`；卡片、表格容器撑满；工具栏 `shrink-0 bg-sunken/40`；loading/error/empty 三态包进可滚动的 flex 容器；表头 `sticky top-0` 并提升字重/对比度；行 hover 用 `bg-row-hover` + 150ms 过渡；分页条包进 `shrink-0` 固定卡片底部 |
| `src/components/layout/AppShell.tsx` | 右列改纵向 flex，滚动收敛到 `main`（`overflow-y-auto`）；footer 移出滚动流改为固定底栏；提示条 `shrink-0`；侧栏分组标题改 `text-accent/70` + `text-ink-soft` + `bg-line-strong`，导航组 hover 用 `bg-row-hover` |
| `src/styles.css` | 亮色 `:root` 新增 4 个层次令牌；联邦 `.adm-federated` 内补同值令牌（避免跨窗口串色）并补 `height:100%` 高度链兜底；`:focus-visible` 改 `color-mix(in srgb, var(--color-focus) 62%, transparent)` |
| `src/federation/federation.css` | 暗色联邦令牌新增 4 个层次令牌：`--color-group-head:#282f3a`、`--color-guide:#3b424c`、`--color-focus:#7fa8f5`、`--color-row-hover:#2b323d` |
| `src/components/crud/linked-group.tsx` | 左栏导航组激活态加 accent 左竖条 + 淡底；右栏容器行 `bg-group-head` + 引导线（depth 0 用 accent、深层用 guide）；文件夹开合图标；计数改等宽字体；叶子行加 `CornerDownRight`；「停用」改 Badge；hover 统一 `bg-row-hover` |
| `src/components/crud/linked-menu.tsx` | 应用分组激活态左竖条 + 淡底；`Folder` 图标、`Badge` 停用、计数等宽化、hover 改 `bg-row-hover` |
| `src/components/crud/scope-panel.tsx` | aside 改纵向 flex，内容区 `min-h-0 flex-1`，头部/提示条 `shrink-0`；「全部」与分组项加左竖条激活态；父级 `FolderOpen` / 子级 `CornerDownRight` 图标区分；父子字重区分；叶子无障碍占位补 guide 引导线 |
| `src/components/crud/tree.tsx` | `TreeRow` 父节点 `bg-group-head` + 左竖条 + `FolderTree`、叶子 `KeyRound` + 常规字重；`GroupHeader` 加 `Folder`、计数等宽化；`PermCheckList` 分组头 `bg-group-head` + guide 左竖条 + `FolderOpen`；权限叶子改 `label={undefined}` + `CornerDownRight` + 常规字重，hover 统一 `bg-row-hover` |
| `src/pages/RolesPage.tsx` | 权限抽屉只读列表中「停用」文案统一为 `Badge tone="warn"` |
| `src/pages/UsersPage.tsx` | 角色抽屉渲染项中「停用」文案统一为 `Badge tone="warn"`（一致性收尾，1 行） |

## 三、验证结果

| 项目 | 结论 | 证据 |
|------|------|------|
| TypeScript 类型检查 | **PASS** | `./node_modules/.bin/tsc --noEmit` → `EXIT=0`，无诊断输出 |
| 单元测试 | **PASS** | `./node_modules/.bin/vitest run` → `Test Files 11 passed (11)`；`Tests 89 passed (89)`；`VITEST_EXIT=0`，耗时 1.25s |
| 生产构建 | **PASS** | `./node_modules/.bin/vite build --outDir /tmp/adm-web-build-verify --emptyOutDir false` → `✓ 1781 modules transformed`、`✓ built in 12.15s`、`BUILD_EXIT=0`；Module Federation DTS 正常生成 |
| 产物结构 | **PASS** | `/tmp/adm-web-build-verify/index.html` 存在（2058 B，含 charset/viewport/color-scheme/theme-color 及 inline SVG favicon）；`assets/` 下 23 个文件，主样式 `styles-BximvJMF.css` 50.45 kB；`remoteEntry.js`、`mf-manifest.json`、`@mf-types.zip` 齐全 |
| 新增令牌入产物 | **PASS** | `styles-BximvJMF.css` 含亮色 `--color-group-head:#f1f4f9`、`--color-row-hover:#eef2f8` 及工具类 `.bg-group-head{background-color:var(--color-group-head)}`、`.bg-row-hover{...}`；`AdmFederatedApp-C0w7R2FZ.css` 含暗色 `--color-group-head: #282f3a`、`--color-row-hover: #2b323d` |

**环境规避说明**：未执行 `npm run build`——本环境 `vite build` 默认清理 `dist/` 会触发沙箱批量删除保护。改用输出到 `/tmp/adm-web-build-verify` 且 `--emptyOutDir false`，构建完整通过，未触碰仓库 `dist/`。

## 四、运行方式

```bash
cd /Users/zbz/workspace/rusthing/adm-rs/adm-web

# 开发服务器
./node_modules/.bin/vite --host localhost --port 5181
```

- **独立站**：直接访问 `http://localhost:5181`，走 `#root` 的高度链。
- **联邦环境**：以宿主应用挂载 `remoteEntry.js` 的方式接入，根节点为 `.adm-federated`（宿主给定确定高度）。本次改造在两套根节点都内置了层次令牌与 `height:100%` 兜底，需分别在两种环境确认视觉一致。
- 生产产物在 `/tmp/adm-web-build-verify`（仅验证用，未部署）。

## 五、浏览器 Visual QA 重点

参照质量审查官清单，请人工在浏览器中逐项确认：

1. **列表页数据态**：数据多（>2 屏，验证表格区滚动而表头/分页不动）、数据少（不足一屏，验证卡片不塌陷、footer 不上浮）、空态（无匹配/无数据，验证 EmptyState 垂直居中且可滚动）三态。
2. **sticky 表头**：纵向滚动时表头吸顶；横向滚动时首列吸左；两者交叉的左上角单元格不重叠、不穿透（z-20 / z-10）。
3. **分页固定**：长表格滚动到底部时分页条始终贴在卡片底部，不随内容滚走。
4. **授权抽屉**：分组行（淡底 + 左竖条 + 文件夹图标 + 加粗）与权限叶子行（引导箭头 + 常规字重）在亮/暗主题下均能一眼区分；左栏导航分组与右栏勾选容器语义不混淆；计数等宽数字不跳动。
5. **主题**：亮色与暗色两套令牌下，分组淡底、引导线、焦点环对比度均达标。
6. **视口**：375 / 768 / 1024 / 1440 四档，重点看 1024 断点 `lg:flex-row` 切换、窄屏横向滚动、侧栏折叠态。
7. **键盘可达**：Tab 顺序符合视觉顺序；`:focus-visible` 焦点环在新令牌下清晰可见；抽屉/树形勾选的键盘操作不受 `label={undefined}` 改动影响。

## 六、遗留说明

- 构建产物输出在 `/tmp/adm-web-build-verify`，属临时目录，重启/清理后不保留；仓库 `dist/` 未更新。
- 认证、菜单、权限等后端接口在构建验证阶段未联调，空态/错误态文案依赖真实返回，需在运行环境抽查。
- `DESIGN-distinction.md` 为未跟踪新增文件，确认是否需要纳入版本库（非构建输入）。
- 以上 Visual QA 为静态审查无法覆盖的动态行为，需在浏览器中人工确认后方可视为最终验收。
