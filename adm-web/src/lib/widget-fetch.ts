import { ApiError } from "@/lib/http";
import { readSession } from "@/lib/auth-storage";
import type { AdmWidgetDataVo } from "@/lib/types";

/**
 * widget 数据直连。
 *
 * 最终架构下前端经 gatex 访问各服务：
 * - `adm` 走 adm-web 既有的 API 前缀（开发期 `/api`，生产同源 `/adm`）
 * - 其它服务按 gatex 的 Service matcher 约定走 `/{service}-svr`
 *   （例如 `/jobx-svr/jobx/widget-data/stats.today`，网关会剥掉 `/jobx-svr`）
 * - 逻辑服务键与真实服务名不一致的两项单独映射：`msg → msgrs-svr`、
 *   `dtw → dtwrs-svr`，其余仍按 `${service}-svr` 兜底
 *
 * 可通过 `VITE_SERVICE_BASES` 覆盖任意服务的基地址，例如：
 * `VITE_SERVICE_BASES='{"jobx":"/jobx-svr","oss":"https://gateway.example/oss-svr"}'`
 *
 * 这里**不**转发任何服务到服务令牌；浏览器只发自己的 `X-User-Id`，
 * 真实鉴权与路由由 gatex 负责。
 */
const API_BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/+$/, "");
const GATEWAY_BASE = (import.meta.env.VITE_GATEWAY_BASE ?? "").replace(/\/+$/, "");

let serviceOverrides: Record<string, string> = {};
try {
  const raw = import.meta.env.VITE_SERVICE_BASES;
  if (raw) serviceOverrides = JSON.parse(raw) as Record<string, string>;
} catch {
  serviceOverrides = {};
}

/** 逻辑服务键 → 网关服务前缀；与后端实际服务名不一致的项在此映射 */
const SERVICE_PREFIX: Record<string, string> = {
  msg: "msgrs-svr",
  dtw: "dtwrs-svr",
};

/** 逻辑服务键 → 请求基地址（只在前端寻址，不含任何后端注册表） */
export function serviceBase(service: string): string {
  const override = serviceOverrides[service];
  if (override) return override.replace(/\/+$/, "");
  if (service === "adm") return API_BASE;
  return `${GATEWAY_BASE}/${SERVICE_PREFIX[service] ?? `${service}-svr`}`;
}

export interface WidgetFetchInput {
  service: string;
  endpoint: string;
  params?: Record<string, unknown>;
  title: string;
  widgetType: string;
}

/**
 * 调用单个服务的 widget 数据端点并返回统一信封。
 *
 * 任何失败都收敛成 `status=error`，由调用方只降级这一张卡片；
 * 卡片本身始终保留，不会因为某个服务不可用而整页空白。
 */
export async function fetchWidget(input: WidgetFetchInput): Promise<AdmWidgetDataVo> {
  const session = readSession();
  const url = `${serviceBase(input.service)}/${input.service}/widget-data/${encodeURIComponent(input.endpoint)}`;

  const fallback = (error: unknown): AdmWidgetDataVo => ({
    widgetType: input.widgetType,
    title: input.title,
    status: "error",
    error:
      error instanceof ApiError
        ? `${input.service}/${input.endpoint}：${error.message}`
        : `${input.service}/${input.endpoint}：${
            error instanceof Error ? error.message : "请求失败"
          }`,
    generatedMs: String(Date.now()),
  });

  const headers = new Headers({ "Content-Type": "application/json" });
  if (session) {
    // 浏览器入口的令牌只用于网关鉴权；adm-svr 不向其它服务转发。
    headers.set("Authorization", `Bearer ${session.token}`);
    headers.set("X-User-Id", session.userId);
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ params: input.params ?? {}, title: input.title }),
      signal: AbortSignal.timeout(8_000),
    });

    const text = await response.text();
    if (!response.ok) {
      return fallback(new ApiError(`HTTP ${response.status} ${text.slice(0, 120)}`, { status: response.status }));
    }
    const payload = JSON.parse(text) as {
      result?: number;
      msg?: string;
      extra?: AdmWidgetDataVo;
    };
    if (payload.result !== 1) {
      return fallback(new ApiError(payload.msg || "服务返回业务失败"));
    }
    const envelope = payload.extra;
    if (!envelope) {
      return fallback(new ApiError("服务未返回 widget 信封"));
    }
    return {
      widgetType: input.widgetType || envelope.widgetType,
      title: input.title || envelope.title,
      status: envelope.status ?? "ok",
      data: envelope.data,
      error: envelope.error,
      generatedMs: envelope.generatedMs ?? String(Date.now()),
    };
  } catch (error) {
    return fallback(error);
  }
}
