import { useEffect, useMemo, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { dashboardApi, roleApi } from "@/lib/api";
import { fetchWidget } from "@/lib/widget-fetch";
import type {
  AdmDashboardSaveInput,
  AdmDashboardVo,
  AdmWidgetServiceVo,
  AdmWidgetTypeVo,
  DashboardWidgetView,
} from "@/lib/types";
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Panel,
  Select,
  Spinner,
  Switch,
  Textarea,
} from "@/components/ui/primitives";
import { Modal, useConfirm, useToast } from "@/components/ui/overlay";
import { WidgetRenderer } from "@/components/dashboard/WidgetRenderer";
import { cn } from "@/lib/utils";
import { useUnsavedGuard } from "@/lib/unsaved-guard";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  GripVertical,
  Info,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";

/** 本地编辑态：params 以 JSON 文本保存，便于可视化修改。 */
interface DraftWidget {
  key: string;
  widgetType: string;
  title: string;
  service: string;
  endpoint: string;
  paramsText: string;
  permUrn: string;
  scopeAware: boolean;
  enabled: boolean;
}

interface DraftConfig {
  name: string;
  remark: string;
  enabled: boolean;
  widgets: DraftWidget[];
}

let draftSeq = 0;
const nextKey = () => `draft-${(draftSeq += 1)}`;

const emptyDraft = (roleTarget: string, roleName?: string): DraftConfig => ({
  name: roleTarget ? `${roleName ?? "角色"}首页` : "全局兜底首页",
  remark: "",
  enabled: true,
  widgets: [],
});

function fromConfig(config: AdmDashboardVo | null | undefined, target: string, roleName?: string): DraftConfig {
  if (!config) return emptyDraft(target, roleName);
  return {
    name: config.name,
    remark: config.remark ?? "",
    enabled: config.enabled,
    widgets: config.widgets.map((widget) => ({
      key: nextKey(),
      widgetType: widget.widgetType,
      title: widget.title,
      service: widget.service,
      endpoint: widget.endpoint,
      paramsText: JSON.stringify(widget.params ?? {}, null, 0),
      permUrn: widget.permUrn ?? "",
      scopeAware: widget.scopeAware,
      enabled: widget.enabled,
    })),
  };
}

function parseParams(text: string): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  const trimmed = text.trim();
  if (!trimmed) return { ok: true, value: {} };
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, error: "参数必须是 JSON 对象" };
    }
    return { ok: true, value: parsed as Record<string, unknown> };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "JSON 解析失败" };
  }
}

function buildWidgets(widgets: DraftWidget[]): { ok: true; value: AdmDashboardSaveInput["widgets"] } | { ok: false; error: string } {
  const value: AdmDashboardSaveInput["widgets"] = [];
  for (const [index, widget] of widgets.entries()) {
    if (!widget.title.trim()) return { ok: false, error: `第 ${index + 1} 个 widget 缺少标题` };
    if (!widget.widgetType) return { ok: false, error: `第 ${index + 1} 个 widget 缺少类型` };
    if (!widget.service || !widget.endpoint) {
      return { ok: false, error: `第 ${index + 1} 个 widget 未选择服务或端点` };
    }
    const params = parseParams(widget.paramsText);
    if (!params.ok) return { ok: false, error: `第 ${index + 1} 个 widget 参数错误：${params.error}` };
    value.push({
      widgetType: widget.widgetType,
      title: widget.title.trim(),
      service: widget.service,
      endpoint: widget.endpoint,
      params: params.value,
      permUrn: widget.permUrn.trim() || undefined,
      scopeAware: widget.scopeAware,
      enabled: widget.enabled,
    });
  }
  return { ok: true, value };
}

/**
 * 首页配置管理。
 *
 * 只编辑逻辑 `service` + `endpoint` 与参数；真实服务地址、凭据都在服务端
 * 注册表里，前端不可见。保存时按当前数组顺序提交，后端重算 sortOrder。
 */
export function DashboardConfigPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<string>("");
  // 取消切换目标时受控 Select 的 DOM 值已被浏览器改掉，用它触发一次重渲染把值拉回来。
  const [, forceTargetSync] = useState(0);
  const [draft, setDraft] = useState<DraftConfig>(() => emptyDraft(""));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newType, setNewType] = useState("");
  const [preview, setPreview] = useState<DashboardWidgetView[] | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  /** 拖拽只记 widget.key；拖动过程中数组会重排，索引会失效。 */
  const [dragState, setDragState] = useState<{
    pointerId: number;
    key: string;
    startX: number;
    startY: number;
  } | null>(null);

  useUnsavedGuard(dirty, "首页配置有未保存的修改，离开后会丢失这些修改。");

  const rolesQuery = useQuery({
    queryKey: ["dashboard", "role-options"],
    queryFn: () => roleApi.list(),
    staleTime: 60_000,
  });
  const configsQuery = useQuery({
    queryKey: ["dashboard", "configs"],
    queryFn: () => dashboardApi.listConfigs(),
  });
  const typesQuery = useQuery({
    queryKey: ["dashboard", "widget-types"],
    queryFn: () => dashboardApi.widgetTypes(),
  });
  const servicesQuery = useQuery({
    queryKey: ["dashboard", "endpoints"],
    queryFn: () => dashboardApi.endpoints(),
    staleTime: 30_000,
  });
  const configQuery = useQuery({
    queryKey: ["dashboard", "config", target],
    queryFn: () => dashboardApi.getConfig(target || undefined),
  });

  const roles = rolesQuery.data ?? [];
  const types = typesQuery.data ?? [];
  const services = servicesQuery.data ?? [];
  const configuredRoleIds = useMemo(
    () => new Set((configsQuery.data ?? []).map((config) => config.roleId).filter(Boolean) as string[]),
    [configsQuery.data],
  );
  const currentRoleName = roles.find((role) => role.id === target)?.name;
  // 下拉只列启用项，但已保存配置可能引用停用/已下线的项：额外补一条「当前值」
  // 占位，避免 <select value=...> 找不到 option 被浏览器静默改成第一项。
  const enabledTypes = types.filter((type) => type.enabled);
  const enabledServices = services.filter((item) => item.enabled);

  // 目标切换 / 远程配置变化时同步到本地草稿；正在请求时不覆盖，避免串数据
  useEffect(() => {
    if (!configQuery.isSuccess || configQuery.isFetching) return;
    setDraft(fromConfig(configQuery.data, target, currentRoleName));
    setDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configQuery.isSuccess, configQuery.isFetching, configQuery.data, target]);

  useEffect(() => {
    if (!newType && types.length > 0) {
      const first = types.find((type) => type.enabled) ?? types[0];
      setNewType(first.code);
    }
  }, [types, newType]);

  const patchDraft = (patch: Partial<DraftConfig>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setDirty(true);
  };

  const patchWidget = (key: string, patch: Partial<DraftWidget>) => {
    setDraft((current) => ({
      ...current,
      widgets: current.widgets.map((widget) => (widget.key === key ? { ...widget, ...patch } : widget)),
    }));
    setDirty(true);
  };

  const moveWidget = (index: number, delta: number) => {
    const targetIndex = index + delta;
    setDraft((current) => {
      if (targetIndex < 0 || targetIndex >= current.widgets.length) return current;
      const widgets = [...current.widgets];
      const [moved] = widgets.splice(index, 1);
      widgets.splice(targetIndex, 0, moved);
      return { ...current, widgets };
    });
    setDirty(true);
  };

  /**
   * 拖拽排序用 Pointer Events：HTML5 drag 在触屏上完全不可用。
   * 手柄 setPointerCapture 后持续收到 move，`elementFromPoint` 找出指针下方
   * 的行（按 widget.key 定位，不用会在重排中失效的索引）。
   */
  const beginDrag = (key: string, event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({ pointerId: event.pointerId, key, startX: event.clientX, startY: event.clientY });
  };

  const dragOver = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    if (Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY) < 6) return;
    const element = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-widget-key]");
    const targetKey = element?.getAttribute("data-widget-key");
    if (!targetKey || targetKey === dragState.key) return;
    if (!draft.widgets.some((item) => item.key === targetKey)) return;
    if (!draft.widgets.some((item) => item.key === dragState.key)) return;
    setDraft((current) => {
      const from = current.widgets.findIndex((item) => item.key === dragState.key);
      const to = current.widgets.findIndex((item) => item.key === targetKey);
      if (from < 0 || to < 0 || from === to) return current;
      const widgets = [...current.widgets];
      const [item] = widgets.splice(from, 1);
      widgets.splice(to, 0, item);
      return { ...current, widgets };
    });
    setDirty(true);
  };

  const endDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    setDragState(null);
  };

  const cancelDrag = () => setDragState(null);

  const addWidget = (typeCode: string) => {
    const type = types.find((item) => item.code === typeCode);
    if (!type) return;
    const service = services.find((item) => item.code === type.defaultService);
    const endpoint = service?.endpoints.find((item) => item.key === type.defaultEndpoint);
    setDraft((current) => ({
      ...current,
      widgets: [
        ...current.widgets,
        {
          key: nextKey(),
          widgetType: type.code,
          title: type.name,
          service: type.defaultService,
          endpoint: endpoint?.key ?? type.defaultEndpoint,
          paramsText: JSON.stringify(type.defaultParams ?? {}, null, 0),
          permUrn: type.defaultPermUrn ?? "",
          scopeAware: type.defaultScopeAware,
          enabled: true,
        },
      ],
    }));
    setDirty(true);
  };

  const applyWidgetType = (widget: DraftWidget, typeCode: string) => {
    const type: AdmWidgetTypeVo | undefined = types.find((item) => item.code === typeCode);
    if (!type) {
      patchWidget(widget.key, { widgetType: typeCode });
      return;
    }
    patchWidget(widget.key, {
      widgetType: type.code,
      title: widget.title || type.name,
      service: type.defaultService,
      endpoint: type.defaultEndpoint,
      paramsText: JSON.stringify(type.defaultParams ?? {}, null, 0),
      permUrn: type.defaultPermUrn ?? "",
      scopeAware: type.defaultScopeAware,
    });
  };

  const applyService = (widget: DraftWidget, serviceCode: string) => {
    const service = services.find((item) => item.code === serviceCode);
    const endpoint = service?.endpoints.find((item) => item.enabled);
    patchWidget(widget.key, {
      service: serviceCode,
      endpoint: endpoint?.key ?? "",
    });
  };

  /** 配置尚未读完时禁止保存，避免把空草稿覆盖到目标角色/全局模板。 */
  const configBusy = configQuery.isLoading || configQuery.isFetching;

  const changeTarget = async (next: string) => {
    if (next === target) return;
    if (dirty) {
      const ok = await confirm({
        title: "放弃未保存的修改？",
        description: "当前配置有未保存修改，切换目标后会丢弃这些修改。",
        confirmText: "切换",
        cancelText: "继续编辑",
      });
      if (!ok) {
        // 浏览器已经改掉了受控 Select 的 DOM 值，强制重渲染回到当前目标。
        forceTargetSync((value) => value + 1);
        return;
      }
    }
    setDirty(false);
    setPreview(null);
    setTarget(next);
  };

  const save = async () => {
    if (configBusy) {
      toast.error("配置仍在读取中，请稍后再保存");
      return;
    }
    if (!draft.name.trim()) {
      toast.error("配置名称不能为空");
      return;
    }
    const built = buildWidgets(draft.widgets);
    if (!built.ok) {
      toast.error(built.error);
      return;
    }
    setSaving(true);
    try {
      const saved = await dashboardApi.saveConfig({
        roleId: target || undefined,
        name: draft.name.trim(),
        remark: draft.remark.trim() || undefined,
        enabled: draft.enabled,
        widgets: built.value,
      });
      if (saved) setDraft(fromConfig(saved, target, currentRoleName));
      setDirty(false);
      toast.success("首页配置已保存");
      await Promise.all([
        configQuery.refetch(),
        configsQuery.refetch(),
        queryClient.invalidateQueries({ queryKey: ["dashboard", "effective"] }),
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const removeConfig = async () => {
    if (!target) {
      toast.error("全局兜底模板不能删除");
      return;
    }
    const ok = await confirm({
      title: "删除角色首页配置",
      description: "删除后该角色将回落到全局兜底模板，当前草稿中的未保存修改也会一并丢弃。",
      confirmText: "删除",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await dashboardApi.deleteConfig(target);
      setDirty(false);
      setPreview(null);
      toast.success("已删除角色首页配置");
      await Promise.all([
        configQuery.refetch(),
        configsQuery.refetch(),
        queryClient.invalidateQueries({ queryKey: ["dashboard", "effective"] }),
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败");
    }
  };

  const runPreview = async () => {
    const built = buildWidgets(draft.widgets);
    if (!built.ok) {
      toast.error(built.error);
      return;
    }
    const placeholders: DashboardWidgetView[] = built.value.map((widget, index) => ({
      key: `preview-${index + 1}`,
      widgetType: widget.widgetType,
      title: widget.title,
      scopeAware: widget.scopeAware,
      sortOrder: (index + 1) * 10,
      status: widget.enabled ? "loading" : "disabled",
    }));
    setPreview(placeholders);
    setPreviewLoading(true);
    try {
      // 预览与首页同路径：按 service/endpoint 并行调用各服务，单卡片失败只降级自身
      const fetched = await Promise.all(
        built.value.map(async (widget, index) => {
          if (!widget.enabled) return placeholders[index];
          const envelope = await fetchWidget({
            service: widget.service,
            endpoint: widget.endpoint,
            params: widget.params,
            title: widget.title,
            widgetType: widget.widgetType,
          });
          return {
            ...placeholders[index],
            status: envelope.status,
            data: envelope.data,
            error: envelope.error,
            generatedMs: envelope.generatedMs,
          };
        }),
      );
      setPreview(fetched);
    } catch (error) {
      // fetchWidget 正常会把失败收进信封，但 Promise.all 仍可能因异常整体拒绝；
      // 这时别让预览卡在 loading 占位上。
      toast.error(error instanceof Error ? error.message : "预览失败");
      setPreview(
        placeholders.map((item) =>
          item.status === "loading" ? { ...item, status: "error" as const, error: "预览请求失败" } : item,
        ),
      );
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="首页配置"
        subtitle="按角色维护 widget 列表；多角色用户取角色优先级最高的第一份，未命中时回落到全局模板。"
        actions={
          <>
            {dirty && <Badge tone="warn">未保存</Badge>}
            <Button variant="secondary" size="sm" onClick={() => void runPreview()} disabled={previewLoading}>
              <Eye size={14} /> {previewLoading ? "预览中…" : "预览"}
            </Button>
            {target && (
              <Button variant="danger" size="sm" onClick={() => void removeConfig()}>
                <Trash2 size={14} /> 删除
              </Button>
            )}
            <Button variant="primary" size="sm" onClick={() => void save()} disabled={saving || configBusy}>
              <Save size={14} /> {saving ? "保存中…" : "保存配置"}
            </Button>
          </>
        }
      />

      <Panel
        title="配置目标"
        description="全局模板始终存在且不可删除；角色配置删除后自动回落。"
        className="mb-4"
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Field label="目标角色">
            <Select
              value={target}
              onChange={(event) => void changeTarget(event.target.value)}
              disabled={saving}
            >
              <option value="">全局兜底模板</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                  {configuredRoleIds.has(role.id) ? "（已配置）" : "（未配置）"}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="配置名称" required>
            <Input
              value={draft.name}
              maxLength={64}
              disabled={saving}
              onChange={(event) => patchDraft({ name: event.target.value })}
            />
          </Field>
          <Field label="备注" hint="可选，最多 255 字">
            <Input
              value={draft.remark}
              maxLength={255}
              disabled={saving}
              onChange={(event) => patchDraft({ remark: event.target.value })}
            />
          </Field>
          <Field label="配置启用">
            <div className="flex h-9 items-center gap-3">
              <Switch
                checked={draft.enabled}
                onChange={(checked) => patchDraft({ enabled: checked })}
                label={draft.enabled ? "启用" : "停用"}
              />
              {configQuery.isFetching && <span className="text-[11.5px] text-muted">读取中…</span>}
            </div>
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11.5px] text-muted">
          <Info size={13} />
          <span>
            widget 只保存逻辑 <code className="font-mono">service</code> +{" "}
            <code className="font-mono">endpoint</code> 与参数；服务地址由 gatex 按服务名解析，配置里不含 URL 与凭据。
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void Promise.all([configQuery.refetch(), servicesQuery.refetch()])}
          >
            <RefreshCw size={13} /> 刷新
          </Button>
        </div>
      </Panel>

      <Panel
        title="Widget 列表"
        description="按住行左侧手柄拖动（鼠标与触屏均可），或使用上移 / 下移调整顺序；保存时按当前顺序重算 sortOrder。"
        actions={
          <div className="flex items-center gap-2">
            <Select
              value={newType}
              onChange={(event) => setNewType(event.target.value)}
              disabled={types.length === 0}
              className="h-7 w-[170px] text-[12px]"
            >
              {newType && !enabledTypes.some((type) => type.code === newType) && (
                <option value={newType}>{newType}（当前值，已停用）</option>
              )}
              {enabledTypes.map((type) => (
                <option key={type.id} value={type.code}>
                  {type.name}
                </option>
              ))}
            </Select>
            <Button
              variant="soft"
              size="sm"
              onClick={() => addWidget(newType)}
              disabled={!newType || configQuery.isLoading}
            >
              <Plus size={14} /> 添加 widget
            </Button>
          </div>
        }
        bodyClassName="p-3"
      >
        {configQuery.isLoading && <Spinner label="正在读取配置…" />}

        {configQuery.isError && (
          <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-[12px] leading-relaxed text-danger">
            <span className="flex-1">
              读取配置失败：
              {configQuery.error instanceof Error
                ? configQuery.error.message
                : "接口没有返回具体原因，请确认 adm-svr 已启动。"}
            </span>
            <Button variant="secondary" size="sm" onClick={() => void configQuery.refetch()}>
              <RefreshCw size={13} /> 重试
            </Button>
          </div>
        )}

        {!configQuery.isLoading && !configQuery.isError && draft.widgets.length === 0 && (
          <EmptyState
            title="还没有 widget"
            description="从上方选择 widget 类型后点击「添加 widget」，或保存一份空配置。"
          />
        )}

        <div className="flex flex-col gap-2.5">
          {draft.widgets.map((widget, index) => {
            const service = services.find((item) => item.code === widget.service);
            const endpoints = service?.endpoints.filter((item) => item.enabled) ?? [];
            const paramsError = parseParams(widget.paramsText);
            return (
              <div
                key={widget.key}
                data-widget-key={widget.key}
                className={cn(
                  "rounded-xl border border-line bg-surface p-3 transition-colors",
                  !widget.enabled && "opacity-70",
                  dragState?.key === widget.key && "border-accent ring-2 ring-accent/20",
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    aria-label={`拖拽调整第 ${index + 1} 个 widget 的顺序`}
                    title="按住拖拽排序（鼠标 / 触屏均可）"
                    onPointerDown={(event) => beginDrag(widget.key, event)}
                    onPointerMove={dragOver}
                    onPointerUp={endDrag}
                    onPointerCancel={cancelDrag}
                    className="touch-none cursor-grab rounded p-1 text-muted transition-colors hover:bg-sunken hover:text-ink active:cursor-grabbing"
                  >
                    <GripVertical size={16} />
                  </button>
                  <span className="tnum w-6 shrink-0 text-[11px] text-muted">{(index + 1).toString().padStart(2, "0")}</span>
                  <Input
                    value={widget.title}
                    maxLength={64}
                    placeholder="卡片标题"
                    className="h-8 min-w-[160px] flex-1 text-[12.5px]"
                    onChange={(event) => patchWidget(widget.key, { title: event.target.value })}
                  />
                  <Switch
                    checked={widget.enabled}
                    onChange={(checked) => patchWidget(widget.key, { enabled: checked })}
                    label={widget.enabled ? "启用" : "停用"}
                  />
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" disabled={index === 0} onClick={() => moveWidget(index, -1)} title="上移">
                      <ChevronUp size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={index === draft.widgets.length - 1}
                      onClick={() => moveWidget(index, 1)}
                      title="下移"
                    >
                      <ChevronDown size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      title="删除 widget"
                      onClick={() =>
                        patchDraft({ widgets: draft.widgets.filter((item) => item.key !== widget.key) })
                      }
                    >
                      <Trash2 size={14} className="text-danger" />
                    </Button>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <Field label="widget 类型">
                    <Select
                      value={widget.widgetType}
                      onChange={(event) => applyWidgetType(widget, event.target.value)}
                      className="h-8 text-[12px]"
                    >
                      {widget.widgetType && !enabledTypes.some((type) => type.code === widget.widgetType) && (
                        <option value={widget.widgetType}>{widget.widgetType}（当前值，已停用）</option>
                      )}
                      {enabledTypes.map((type) => (
                        <option key={type.id} value={type.code}>
                          {type.name}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field
                    label="服务"
                    hint={
                      service
                        ? service.enabled
                          ? "地址由 gatex 按服务名解析"
                          : "该服务在端点目录里已停用"
                        : "该服务不在端点目录"
                    }
                  >
                    <Select
                      value={widget.service}
                      onChange={(event) => applyService(widget, event.target.value)}
                      className="h-8 text-[12px]"
                    >
                      {widget.service && !enabledServices.some((item) => item.code === widget.service) && (
                        <option value={widget.service}>{widget.service}（当前值，已停用或不在目录）</option>
                      )}
                      {enabledServices.map((item) => (
                        <option key={item.code} value={item.code}>
                          {item.name}（{item.code}）
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="端点" hint={endpointHint(service, widget.endpoint)}>
                    <Select
                      value={widget.endpoint}
                      onChange={(event) => patchWidget(widget.key, { endpoint: event.target.value })}
                      className="h-8 text-[12px]"
                    >
                      {endpoints.length === 0 && <option value="">（无可用端点）</option>}
                      {widget.endpoint && !endpoints.some((endpoint) => endpoint.key === widget.endpoint) && (
                        <option value={widget.endpoint}>{widget.endpoint}（当前值，已停用或不在目录）</option>
                      )}
                      {endpoints.map((endpoint) => (
                        <option key={endpoint.key} value={endpoint.key}>
                          {endpoint.name}（{endpoint.key}）
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="权限要求" hint="URN 前缀；留空表示不校验">
                    <Input
                      value={widget.permUrn}
                      maxLength={128}
                      placeholder="GET:/adm/user"
                      className="h-8 font-mono text-[12px]"
                      onChange={(event) => patchWidget(widget.key, { permUrn: event.target.value })}
                    />
                  </Field>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
                  <Field
                    label="参数（JSON 对象）"
                    hint={serviceHint(service)}
                    error={paramsError.ok ? undefined : paramsError.error}
                  >
                    <Textarea
                      value={widget.paramsText}
                      spellCheck={false}
                      className="min-h-[58px] font-mono text-[11.5px]"
                      onChange={(event) => patchWidget(widget.key, { paramsText: event.target.value })}
                    />
                  </Field>
                  <Field label="按可见范围过滤">
                    <div className="flex h-9 items-center">
                      <Switch
                        checked={widget.scopeAware}
                        onChange={(checked) => patchWidget(widget.key, { scopeAware: checked })}
                        label="scopeAware"
                      />
                    </div>
                  </Field>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <Modal
        open={preview !== null}
        onClose={() => setPreview(null)}
        title="配置预览"
        description="与首页同一路径：按 service/endpoint 并行请求各服务；不落库，且不按当前账号权限过滤。"
        width="max-w-[1040px]"
        footer={
          <Button variant="secondary" onClick={() => setPreview(null)}>
            关闭
          </Button>
        }
      >
        {previewLoading && <Spinner label="正在并行请求各服务…" />}
        {preview && preview.length === 0 && (
          <EmptyState title="没有可预览的 widget" description="启用的 widget 会在这里展示。" />
        )}
        {preview && preview.length > 0 && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {preview.map((widget) => (
              <WidgetRenderer key={widget.key} widget={widget} />
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}

function endpointHint(service: AdmWidgetServiceVo | undefined, endpoint: string): string | undefined {
  const item = service?.endpoints.find((entry) => entry.key === endpoint);
  if (!item) return undefined;
  return [item.method, item.paramsHint, item.note].filter(Boolean).join(" · ");
}

function serviceHint(service: AdmWidgetServiceVo | undefined): string {
  if (!service) return "服务来自逻辑端点目录；真实地址由 gatex 解析。";
  return `${service.name}（${service.code}）· ${service.enabled ? "端点目录已启用" : "端点目录已停用"}`;
}
