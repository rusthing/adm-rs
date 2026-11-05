import { notifySessionExpired, readSession } from "@/lib/auth-storage";
import type { PageQuery, Ro } from "@/lib/types";

const API_BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/+$/, "");

export class ApiError extends Error {
  readonly result?: number;
  readonly code?: string;
  readonly detail?: string;
  readonly status: number;

  constructor(message: string, options: { result?: number; code?: string; detail?: string; status?: number } = {}) {
    super(message);
    this.name = "ApiError";
    this.result = options.result;
    this.code = options.code;
    this.detail = options.detail;
    this.status = options.status ?? 0;
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** 默认带 X-User-Id；鉴权以 Authorization 为准，服务端中间件会用令牌里的用户覆盖该头 */
  userHeader?: boolean;
}

/** 把查询对象拼成 query string，跳过空值。 */
export function toQueryString(query?: PageQuery): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

/**
 * 发送请求并拆 Ro 信封。
 *
 * - HTTP 非 2xx、`result !== 1` 一律抛 `ApiError`
 * - 成功时返回 `extra`（列表/对象/登录结果都在这里）
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T | undefined> {
  const { body, userHeader = true, headers: inputHeaders, ...rest } = options;
  const session = readSession();
  const headers = new Headers(inputHeaders);

  if (body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (session) {
    headers.set("Authorization", `Bearer ${session.token}`);
    if (userHeader) headers.set("X-User-Id", session.userId);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...rest,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    throw new ApiError(
      API_BASE
        ? `无法连接接口（${API_BASE}${path}）：${error instanceof Error ? error.message : "网络错误"}`
        : `无法连接接口（${path}）：${error instanceof Error ? error.message : "网络错误"}`,
      { status: 0 },
    );
  }

  const text = await response.text();
  let payload: Ro<T> | null = null;
  if (text) {
    try {
      payload = JSON.parse(text) as Ro<T>;
    } catch {
      throw new ApiError(`接口返回的不是 JSON（HTTP ${response.status}）`, {
        status: response.status,
        detail: text.slice(0, 200),
      });
    }
  }

  if (!response.ok) {
    const statusHint =
      response.status === 401
        ? "登录状态已失效，请重新登录"
        : response.status === 403
          ? "当前账号没有执行该操作的权限"
          : `请求失败（HTTP ${response.status}）`;
    if (response.status === 401) {
      // 令牌无效/过期/已登出：统一由 AuthProvider 清会话并跳登录页，
      // 不再让用户停在「看着像已登录、点什么都报错」的界面上。
      notifySessionExpired();
    }
    throw new ApiError(payload?.msg || statusHint, {
      status: response.status,
      result: payload?.result,
      code: payload?.code,
      detail: payload?.detail,
    });
  }
  if (!payload) {
    throw new ApiError("接口返回空响应", { status: response.status });
  }
  if (payload.result !== 1) {
    // 少数认证接口在 HTTP 200 里用 ADM00005 表达令牌失效，语义与 401 一致。
    if (payload.code === "ADM00005") notifySessionExpired();
    throw new ApiError(payload.msg || "业务处理失败，服务端未返回具体原因", {
      status: response.status,
      result: payload.result,
      code: payload.code,
      detail: payload.detail,
    });
  }
  return payload.extra;
}
