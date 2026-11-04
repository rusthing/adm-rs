import { useQueries, useQuery } from "@tanstack/react-query";
import { Component, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { dashboardApi } from "@/lib/api";
import { fetchWidget } from "@/lib/widget-fetch";
import { Badge, EmptyState, PageHeader, Panel, Spinner } from "@/components/ui/primitives";
import { WidgetRenderer } from "@/components/dashboard/WidgetRenderer";
import { formatMs, shortId } from "@/lib/utils";
import type { DashboardWidgetView } from "@/lib/types";
import { Globe, LayoutDashboard, RefreshCw, Settings2 } from "lucide-react";

/**
 * 首页完全由后端下发的 dashboard 配置驱动。
 *
 * 配置（哪些 widget、顺序、标题、service/endpoint、权限要求）来自 adm-svr；
 * widget 数据由前端按 `service` 经网关并行直连各服务，单卡片失败只降级自身。
 * 这里不写角色分支，也不感知具体服务来源。
 */
/**
 * 单卡片渲染兜底：某个 widget 渲染异常时只替换这一张卡片，
 * 其余卡片与整页布局保持不动。
 */
class CardBoundary extends Component<{ widgetKey: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  componentDidCatch(error: Error) {
    console.error("[dashboard-widget]", this.props.widgetKey, error.message);
    this.setState({ failed: true });
  }

  render() {
    if (this.state.failed) {
      return (
        <article className="flex h-full min-h-[120px] flex-col items-center justify-center rounded-[14px] border border-line bg-surface p-4 text-center shadow-panel">
          <p className="text-[12.5px] font-medium text-ink">暂不可用</p>
          <p className="mt-1 text-[11.5px] text-muted">该卡片渲染失败，其余卡片不受影响。</p>
        </article>
      );
    }
    return this.props.children;
  }
}

export function DashboardPage() {
  const { session, authz, authzError, authzLoading, refreshAuthz, hasPerm } = useAuth();

  // queryKey 带上 userId：切账号后即使缓存未被清空，也不会复用上一位用户的生效配置。
  const effectiveQuery = useQuery({
    queryKey: ["dashboard", "effective", session?.userId],
    queryFn: () => dashboardApi.effective(),
    staleTime: 30_000,
  });

  // 配置接口尚未返回时先用 /me 下发的快照，避免首屏空白
  const dashboard = effectiveQuery.isSuccess ? (effectiveQuery.data ?? null) : (authz?.dashboard ?? null);
  const configWidgets = dashboard?.widgets ?? [];
  const authzReady = authz !== null;

  const widgetQueries = useQueries({
    queries: configWidgets.map((widget) => ({
      queryKey: [
        "dashboard-widget",
        session?.userId,
        widget.id,
        widget.service,
        widget.endpoint,
        JSON.stringify(widget.params ?? {}),
      ],
      queryFn: () =>
        fetchWidget({
          service: widget.service,
          endpoint: widget.endpoint,
          params: widget.params,
          title: widget.title,
          widgetType: widget.widgetType,
        }),
      // 后端已按权限过滤配置；这里只对本地可见权限做一次兜底
      enabled:
        widget.enabled &&
        (!widget.permUrn || !authzReady || hasPerm(widget.permUrn)),
      retry: false,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    })),
  });

  const views: DashboardWidgetView[] = configWidgets.map((widget, index) => {
    const base = {
      key: widget.id || `w-${index}`,
      widgetType: widget.widgetType,
      title: widget.title,
      scopeAware: widget.scopeAware,
      sortOrder: widget.sortOrder,
    };
    if (!widget.enabled) {
      return { ...base, status: "disabled" as const };
    }
    if (authzReady && widget.permUrn && !hasPerm(widget.permUrn)) {
      return { ...base, status: "forbidden" as const, error: `需要权限 ${widget.permUrn}` };
    }
    const result = widgetQueries[index];
    if (!result || result.isLoading || !result.data) {
      return { ...base, status: "loading" as const };
    }
    return {
      ...base,
      status: result.data.status,
      data: result.data.data,
      error: result.data.error,
      generatedMs: result.data.generatedMs,
    };
  });

  const scopeNames = (authz?.scopes ?? [])
    .map((scope) => scope.roleName || scope.scopeType)
    .filter(Boolean);
  const anyScopeAware = configWidgets.some((widget) => widget.scopeAware);
  const sourceText =
    dashboard?.source === "global"
      ? "全局兜底模板"
      : dashboard?.roleName
        ? `角色首页 · ${dashboard.roleName}`
        : dashboard?.name;
  const generatedMs = views.reduce<string | undefined>((latest, view) => {
    if (!view.generatedMs) return latest;
    return !latest || Number(view.generatedMs) > Number(latest) ? view.generatedMs : latest;
  }, undefined);

  const refreshAll = () => {
    void effectiveQuery.refetch();
    for (const query of widgetQueries) void query.refetch();
  };

  return (
    <div>
      <PageHeader
        title={`你好，${session?.nickName || session?.name || "管理员"}`}
        subtitle={
          dashboard
            ? `${sourceText ?? dashboard.name}，共 ${configWidgets.length} 个 widget；数据由各服务按统一契约返回，前端经网关并行获取。`
            : "正在根据你的角色加载首页配置。"
        }
        actions={
          <>
            {authz && <Badge tone="neutral">{authz.roles.length} 个角色</Badge>}
            {session?.loginPswdDefault && <Badge tone="warn">初始口令</Badge>}
            {hasPerm("GET:/adm/dashboard/config") && (
              <Link
                to="/dashboard-config"
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-line-strong bg-surface px-3.5 text-[13px] font-medium text-ink transition-colors hover:bg-sunken"
              >
                <Settings2 size={14} /> 首页配置
              </Link>
            )}
            <button
              type="button"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-line-strong bg-surface px-3.5 text-[13px] font-medium text-ink hover:bg-sunken"
              onClick={refreshAll}
            >
              <RefreshCw size={14} /> 刷新
            </button>
          </>
        }
      />

      {anyScopeAware && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-warn/25 bg-warn-soft px-3.5 py-3 text-[12px] leading-relaxed text-warn">
          <Globe size={15} className="mt-0.5 shrink-0" />
          <span>
            当前为<strong className="font-semibold">全局数据</strong>：本轮只下发角色数据范围
            （{scopeNames.length > 0 ? scopeNames.join("、") : "暂无范围配置"}），
            widget 查询尚未按组织过滤。卡片上的「全局数据」标记即为如实说明。
          </span>
        </div>
      )}

      {(authzLoading || effectiveQuery.isLoading) && !dashboard && (
        <Panel>
          <Spinner label="正在加载首页配置与 widget 数据…" />
        </Panel>
      )}

      {effectiveQuery.isError && (
        <Panel>
          <EmptyState
            title="首页配置加载失败"
            description={
              effectiveQuery.error instanceof Error
                ? effectiveQuery.error.message
                : "无法获取首页配置，请确认 adm-svr 已启动。"
            }
            action={
              <button
                type="button"
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-line-strong bg-surface px-3.5 text-[13px] font-medium text-ink hover:bg-sunken"
                onClick={() => void effectiveQuery.refetch()}
              >
                <RefreshCw size={14} /> 重试
              </button>
            }
          />
        </Panel>
      )}

      {!effectiveQuery.isLoading && !effectiveQuery.isError && views.length === 0 && (
        <Panel>
          <EmptyState
            title="当前配置没有可用 widget"
            description={
              dashboard
                ? "配置存在，但所有 widget 都被停用，或当前账号缺少对应权限。"
                : "后端没有返回任何首页配置，请检查全局兜底模板。"
            }
            action={
              hasPerm("GET:/adm/dashboard/config") ? (
                <Link to="/dashboard-config" className="inline-flex h-9 items-center gap-2 rounded-lg bg-accent px-3.5 text-[13px] font-medium text-white">
                  <Settings2 size={14} /> 去配置首页
                </Link>
              ) : undefined
            }
          />
        </Panel>
      )}

      {views.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {views.map((view) => (
            <CardBoundary key={view.key} widgetKey={view.key}>
              <WidgetRenderer widget={view} />
            </CardBoundary>
          ))}
        </div>
      )}

      {dashboard && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <LayoutDashboard size={12} />
            {dashboard.id ? (
              <span title={dashboard.id}>配置 {shortId(dashboard.id)}</span>
            ) : (
              "无配置"
            )}{" "}
            · {(authz?.scopes ?? []).length} 个数据范围 ·{" "}
            {anyScopeAware ? "全局数据" : "未启用数据范围"}
          </span>
          <span className="tnum font-mono">
            {generatedMs ? `生成于 ${formatMs(generatedMs)}` : "等待数据…"}
          </span>
        </div>
      )}

      {authzError && (
        <div className="mt-3 rounded-xl border border-danger/25 bg-danger-soft px-3.5 py-3 text-[12px] leading-relaxed text-danger">
          权限加载失败：{authzError}。可以在
          <button type="button" className="mx-1 underline underline-offset-2" onClick={() => void refreshAuthz()}>
            这里重试
          </button>
          ，或先检查 adm-svr 是否已启动。
        </div>
      )}
    </div>
  );
}
