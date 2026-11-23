/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { federation } from "@module-federation/vite";
import { fileURLToPath, URL } from "node:url";
import { scopeUtilities } from "./vite-plugin-scope-utilities.mjs";

/**
 * 开发期把 `/api` 反代到 adm-svr（默认 127.0.0.1:9007，见 adm-svr.toml 的 web.port），
 * 并去掉 `/api` 前缀 —— 后端真实路径是 `/adm/user/page` 这类，不带 `/api`。
 *
 * 换后端地址：VITE_PROXY_TARGET=http://10.0.0.7:9007 pnpm dev
 *
 * 部署到子路径（例如 http://host/adm-web/）时必须给 `PUBLIC_BASE`，它决定 index.html 里
 * 资源引用的前缀，必须和 nginx 的 location 一字不差，否则 `/assets/*.js` 全部 404：
 *   PUBLIC_BASE=/adm-web/ pnpm build
 * 生产值写在 `.env.production`，`pnpm build` 会自动读取；临时覆盖用命令行环境变量（优先级更高）。
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const base = env.PUBLIC_BASE?.trim() || "/";
  const sharedReact = { singleton: true, allowNodeModulesSuffixMatch: true } as const;

  return {
    base,
    plugins: [
      // 联邦只暴露一个页面级模块；独立站照常 createRoot，两者共用 AppRoutes。
      federation({
        name: "adm-web",
        filename: "remoteEntry.js",
        exposes: { "./adm-app": "./src/federation/AdmFederatedApp.tsx" },
        shared: {
          react: sharedReact,
          "react/jsx-runtime": sharedReact,
          "react-dom": sharedReact,
          "react-dom/client": sharedReact,
        },
        // Tailwind 生成的 @theme 变量在页面样式里，必须随暴露模块一起出，
        // 否则宿主只拿到组件、没有令牌，会渲染成无样式的裸 HTML。
        bundleAllCSS: true,
        manifest: true,
      }),
      react(),
      tailwindcss(),
      // 把工具类作用域限制在 .adm-federated 内，避免多联邦应用同名类互相覆盖
      scopeUtilities(".adm-federated"),
    ],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      port: 5181,
      // dev 下联邦 runtime 要用绝对地址取 remoteEntry.js，否则 uiam 会去自己的
      // 端口找，拿到 uiam 的 index.html。
      origin: env.VITE_DEV_ORIGIN?.trim() || "http://localhost:5181",
      proxy: {
        "/api": {
          target: env.VITE_PROXY_TARGET?.trim() || "http://127.0.0.1:9007",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
        // 跨服务 widget 直连：gatex 的 Service matcher 按 `/{svc-name}` 寻址，
        // 开发期用同名前缀直连各 svr，路径剥离方式与网关一致。
        "/oss-svr": {
          target: env.VITE_OSS_TARGET?.trim() || "http://127.0.0.1:9840",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/oss-svr/, ""),
        },
        "/msg-svr": {
          target: env.VITE_MSG_TARGET?.trim() || "http://127.0.0.1:9002",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/msg-svr/, ""),
        },
        "/jobx-svr": {
          target: env.VITE_JOBX_TARGET?.trim() || "http://127.0.0.1:9001",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/jobx-svr/, ""),
        },
      },
    },
    preview: {
      port: 4181,
    },
    build: {
      target: "es2022",
      sourcemap: false,
    },
    test: {
      environment: "node",
      include: ["src/**/*.test.ts"],
    },
  };
});
