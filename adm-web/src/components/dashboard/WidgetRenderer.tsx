import { Link } from "react-router-dom";
import type { DashboardWidgetView, RecentLogItem, TodoItem, TrendPoint } from "@/lib/types";
import { cn, formatMs } from "@/lib/utils";
import { Badge } from "@/components/ui/primitives";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  ClipboardList,
  Clock,
  Globe,
  KeyRound,
  LayoutGrid,
  Loader2,
  Lock,
  ScrollText,
  ShieldCheck,
  Users,
} from "lucide-react";

/** 趋势图、最近日志需要更宽的横向空间。 */
const SPAN: Record<string, string> = {
  trend: "xl:col-span-2",
  recent_logs: "xl:col-span-2",
};

interface KpiData {
  label?: string;
  value?: number | string;
  path?: string;
  metric?: string;
}

interface TrendData {
  days?: number;
  metric?: string;
  points?: TrendPoint[];
  total?: number;
  today?: number;
}

interface TodoData {
  items?: TodoItem[];
  total?: number;
}

interface RecentData {
  source?: string;
  items?: RecentLogItem[];
}

interface ShortcutItem {
  id?: string;
  label?: string;
  name?: string;
  path?: string;
  icon?: string;
}

interface ShortcutData {
  items?: ShortcutItem[];
}

interface PermissionsData {
  roleCount?: number;
  permCount?: number;
  menuCount?: number;
  roles?: Array<{ id?: string; name?: string }>;
  scopeNote?: string;
  scopes?: Array<{ roleName?: string; scopeType?: string }>;
}

type AnyData =
  | KpiData
  | TrendData
  | TodoData
  | RecentData
  | ShortcutData
  | PermissionsData
  | null
  | undefined;

function asData(data: unknown): AnyData {
  return (data ?? null) as AnyData;
}

/**
 * 首页卡片：只认统一信封，不感知数据来自哪个服务。
 *
 * 卡片始终按配置渲染；`loading` / `error` / `disabled` / `forbidden` 都保留
 * 原有占位，只在该卡片内部提示，不会隐藏卡片导致布局跳动。
 */
export function WidgetRenderer({ widget }: { widget: DashboardWidgetView }) {
  return (
    <article
      className={cn(
        "flex h-full flex-col rounded-[14px] border border-line bg-surface shadow-panel",
        SPAN[widget.widgetType],
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-[13.5px] font-semibold text-ink">{widget.title}</h2>
          <p className="mt-0.5 text-[11px] text-muted">{typeLabel(widget.widgetType)}</p>
        </div>
        {widget.scopeAware && (
          <Badge tone="warn">
            <Globe size={11} className="mr-0.5" /> 全局数据
          </Badge>
        )}
      </header>

      <div className="flex flex-1 flex-col p-4">
        {widget.status === "ok" ? (
          <WidgetBody type={widget.widgetType} data={asData(widget.data)} />
        ) : widget.status === "loading" ? (
          <LoadingBody />
        ) : (
          <Unavailable widget={widget} />
        )}
      </div>

      <footer className="flex items-center justify-between border-t border-line px-4 py-2 text-[10.5px] text-muted">
        <span className="truncate">{widget.key ? `#${widget.key}` : "配置预览"}</span>
        <span className="tnum shrink-0 font-mono">
          {widget.status === "loading"
            ? "加载中…"
            : widget.generatedMs
              ? formatMs(widget.generatedMs)
              : "--"}
        </span>
      </footer>
    </article>
  );
}

/** 加载态占位：保持卡片高度，避免请求回来时整页跳动。 */
function LoadingBody() {
  return (
    <div className="flex h-full flex-col justify-between gap-3" aria-busy="true">
      <div className="flex flex-col gap-2">
        <div className="h-3 w-24 animate-pulse rounded bg-sunken" />
        <div className="h-7 w-16 animate-pulse rounded bg-sunken" />
      </div>
      <div className="flex items-center gap-1.5 text-[11.5px] text-muted">
        <Loader2 size={13} className="animate-spin" />
        <span>正在取数…</span>
      </div>
    </div>
  );
}

function WidgetBody({ type, data }: { type: string; data: AnyData }) {
  switch (type) {
    case "kpi":
      return <KpiBody data={data as KpiData} />;
    case "trend":
      return <TrendBody data={data as TrendData} />;
    case "todo":
      return <TodoBody data={data as TodoData} />;
    case "recent_logs":
      return <RecentBody data={data as RecentData} />;
    case "shortcuts":
      return <ShortcutsBody data={data as ShortcutData} />;
    case "my_permissions":
      return <PermissionsBody data={data as PermissionsData} />;
    default:
      return (
        <pre className="max-h-56 overflow-auto rounded-lg bg-sunken p-3 text-[11px] text-ink-soft">
          {JSON.stringify(data ?? {}, null, 2)}
        </pre>
      );
  }
}

function KpiBody({ data }: { data: KpiData }) {
  const value = data?.value;
  const body = (
    <>
      <div className="text-[11.5px] text-muted">{data?.label ?? "指标"}</div>
      <div className="tnum mt-1.5 text-[30px] font-semibold leading-none tracking-[-0.02em] text-ink">
        {value === undefined || value === null ? "--" : value}
      </div>
      <div className="mt-3 flex items-center justify-between text-[11.5px] text-muted">
        <span className="font-mono">{data?.metric ?? ""}</span>
        {data?.path && <ArrowUpRight size={13} />}
      </div>
    </>
  );
  if (!data?.path) {
    return <div className="flex h-full flex-col justify-between">{body}</div>;
  }
  return (
    <Link
      to={data.path}
      className="group flex h-full flex-col justify-between rounded-lg transition-colors hover:text-accent"
    >
      {body}
    </Link>
  );
}

function TrendBody({ data }: { data: TrendData }) {
  const points = data?.points ?? [];
  const max = Math.max(1, ...points.map((point) => point.count));
  const width = 100;
  const height = 38;
  const coords = points.map((point, index) => {
    const x = points.length <= 1 ? width / 2 : (index / (points.length - 1)) * width;
    const y = height - (point.count / max) * (height - 6) - 2;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  return (
    <div className="flex h-full flex-col justify-between">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-[11.5px] text-muted">
            近 {data?.days ?? points.length} 日{data?.metric === "op" ? "操作" : "登录"}趋势
          </div>
          <div className="tnum mt-1 text-[24px] font-semibold leading-none text-ink">
            {data?.total ?? 0}
          </div>
        </div>
        <div className="text-right text-[11.5px] text-muted">
          今日 <span className="tnum font-medium text-ink-soft">{data?.today ?? 0}</span>
        </div>
      </div>
      {points.length > 1 ? (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="mt-4 h-24 w-full"
          role="img"
          aria-label="趋势图"
        >
          <line
            x1="0"
            y1={height - 1}
            x2={width}
            y2={height - 1}
            style={{ stroke: "var(--color-line, #e5e7eb)" }}
          />
          <polyline
            points={coords.join(" ")}
            fill="none"
            strokeWidth="1.6"
            style={{ stroke: "var(--color-accent, #2563eb)" }}
          />
        </svg>
      ) : (
        <p className="mt-4 text-[12px] text-muted">暂无足够的数据点。</p>
      )}
      <div className="mt-2 flex justify-between text-[10.5px] text-muted">
        <span>{points[0]?.date ?? "--"}</span>
        <span>{points[points.length - 1]?.date ?? "--"}</span>
      </div>
    </div>
  );
}

function TodoBody({ data }: { data: TodoData }) {
  const items = data?.items ?? [];
  if (items.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
        <ClipboardList size={20} className="text-muted/60" />
        <p className="text-[12px] text-muted">没有需要处理的待办。</p>
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item.code}>
          <Link
            to={item.path || "#"}
            className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2 transition-colors hover:border-line-strong hover:bg-sunken"
          >
            <span className="flex min-w-0 items-center gap-2">
              <Badge tone={severityTone(item.severity)}>{item.count}</Badge>
              <span className="truncate text-[12.5px] text-ink-soft">{item.label}</span>
            </span>
            <ArrowUpRight size={13} className="shrink-0 text-muted" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function RecentBody({ data }: { data: RecentData }) {
  const items = data?.items ?? [];
  if (items.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
        <ScrollText size={20} className="text-muted/60" />
        <p className="text-[12px] text-muted">暂无{data?.source === "op" ? "操作" : "登录"}日志。</p>
      </div>
    );
  }
  return (
    <ul className="-my-1 divide-y divide-line">
      {items.slice(0, 8).map((item) => (
        <li key={String(item.id)} className="flex items-center justify-between gap-3 py-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[12.5px] text-ink">
              <Users size={12} className="text-muted" />
              <span className="truncate">{item.userName || item.userId || "匿名"}</span>
              {item.title && <span className="truncate text-muted">· {item.title}</span>}
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-[10.5px] text-muted">
              <Clock size={10} />
              <span className="tnum font-mono">{formatMs(String(item.timeMs))}</span>
              {item.ip && <span className="font-mono">{item.ip}</span>}
            </div>
          </div>
          {item.urn && (
            <span className="max-w-[45%] truncate font-mono text-[10px] text-muted">{item.urn}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function ShortcutsBody({ data }: { data: ShortcutData }) {
  const items = data?.items ?? [];
  if (items.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
        <LayoutGrid size={20} className="text-muted/60" />
        <p className="text-[12px] text-muted">当前角色没有可跳转的菜单。</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((item, index) => (
        <Link
          key={item.id ?? `${item.path}-${index}`}
          to={item.path || "#"}
          className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-2 text-[12.5px] text-ink-soft transition-colors hover:border-line-strong hover:bg-sunken"
        >
          <LayoutGrid size={13} className="shrink-0 text-accent" />
          <span className="truncate">{item.label ?? item.name ?? item.path ?? "菜单"}</span>
        </Link>
      ))}
    </div>
  );
}

function PermissionsBody({ data }: { data: PermissionsData }) {
  const stats = [
    { label: "角色", value: data?.roleCount ?? 0, icon: ShieldCheck },
    { label: "权限点", value: data?.permCount ?? 0, icon: KeyRound },
    { label: "菜单", value: data?.menuCount ?? 0, icon: LayoutGrid },
  ];
  return (
    <div className="flex h-full flex-col justify-between gap-3">
      <div className="grid grid-cols-3 gap-2">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="rounded-lg bg-sunken px-2.5 py-2">
              <div className="flex items-center gap-1 text-[10.5px] text-muted">
                <Icon size={11} />
                {stat.label}
              </div>
              <div className="tnum mt-1 text-[17px] font-semibold leading-none text-ink">
                {stat.value}
              </div>
            </div>
          );
        })}
      </div>
      {(data?.roles ?? []).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {(data?.roles ?? []).map((role) => (
            <Badge key={role.id ?? role.name} tone="info">
              {role.name ?? role.id}
            </Badge>
          ))}
        </div>
      )}
      <p className="text-[10.5px] leading-relaxed text-muted">
        {data?.scopeNote ?? "本轮未启用按组织过滤，统计为全局数据。"}
      </p>
    </div>
  );
}

function Unavailable({ widget }: { widget: DashboardWidgetView }) {
  const meta: { icon: typeof Activity; tone: "neutral" | "warn" | "danger"; title: string; text: string } = (
    {
      disabled: { icon: Lock, tone: "neutral" as const, title: "已停用", text: "该卡片在首页配置里被停用。" },
      forbidden: { icon: Lock, tone: "warn" as const, title: "无权限", text: "当前账号缺少该卡片要求的权限。" },
      error: { icon: AlertTriangle, tone: "danger" as const, title: "暂不可用", text: "数据服务暂时不可用，其余卡片不受影响。" },
      loading: { icon: Activity, tone: "neutral" as const, title: "加载中", text: "正在取数…" },
    } as Record<string, { icon: typeof Activity; tone: "neutral" | "warn" | "danger"; title: string; text: string }>
  )[widget.status] ?? {
    icon: Activity,
    tone: "neutral" as const,
    title: "暂不可用",
    text: "未知状态。",
  };
  const Icon = meta.icon;
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
      <div
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full",
          meta.tone === "danger" && "bg-danger-soft text-danger",
          meta.tone === "warn" && "bg-warn-soft text-warn",
          meta.tone === "neutral" && "bg-sunken text-muted",
        )}
      >
        <Icon size={17} />
      </div>
      <p className="text-[12.5px] font-medium text-ink">{meta.title}</p>
      <p className="max-w-[26rem] text-[11.5px] leading-relaxed text-muted">{widget.error || meta.text}</p>
    </div>
  );
}

function severityTone(severity: string): "danger" | "warn" | "info" | "neutral" {
  switch (severity) {
    case "high":
    case "danger":
      return "danger";
    case "medium":
    case "warn":
      return "warn";
    case "info":
      return "info";
    default:
      return "neutral";
  }
}

function typeLabel(type: string): string {
  return (
    {
      kpi: "指标卡",
      trend: "趋势图",
      todo: "待办清单",
      recent_logs: "最近日志",
      shortcuts: "快捷入口",
      my_permissions: "权限摘要",
    }[type] ?? type
  );
}
