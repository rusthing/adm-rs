/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 接口运行时前缀：开发期 `/api`，生产同源留空 */
  readonly VITE_API_BASE?: string;
  /** 认证模式：`required`（缺省）或 `disabled`（仅开发环境免登录） */
  readonly VITE_AUTH_MODE?: "required" | "disabled";
  /** 认证接口前缀（登录 / me / 登出），与 VITE_API_BASE 保持一致 */
  readonly VITE_AUTH_BASE?: string;
  /** `pnpm dev` 时 adm-svr 的反代目标，默认 http://127.0.0.1:9007 */
  readonly VITE_PROXY_TARGET?: string;
  /** 静态服务器无法配置 SPA 回退时设为 `hash`；默认 browser */
  readonly VITE_ROUTER?: "hash" | "browser";
  /** 跨服务 widget 的网关基地址，留空表示同源 */
  readonly VITE_GATEWAY_BASE?: string;
  /** 按逻辑服务名覆盖基地址，值为 JSON 对象字符串 */
  readonly VITE_SERVICE_BASES?: string;
  /** 开发期各服务直连目标（仅 vite proxy 使用） */
  readonly VITE_OSS_TARGET?: string;
  readonly VITE_MSG_TARGET?: string;
  readonly VITE_JOBX_TARGET?: string;
  /** 构建产物挂载路径；不带 VITE_ 前缀，由 vite.config.ts 的 loadEnv 读取 */
  readonly PUBLIC_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
