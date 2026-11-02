/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 接口运行时前缀，例如开发期 `/api`、生产同源留空 */
  readonly VITE_API_BASE?: string;
  /** `pnpm dev` 时的反代目标，默认 http://127.0.0.1:9007 */
  readonly VITE_PROXY_TARGET?: string;
  /** 静态服务器无法配置 SPA 回退时设为 `hash` */
  readonly VITE_ROUTER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
