# 前后端解耦交接文档（Handoff）

> 面向：接手前端仓库的工程师和他们的 AI agent。
> 状态：2026-08-20 已完成生产切流。本仓库是**纯前端**（Cloudflare Workers 上的 Next.js/vinext），后端是独立 Go 服务。

## 1. 架构总览

```
浏览器
  │  https://dshpluginhub.ai（custom domain → Cloudflare Worker）
  ▼
┌──────────────────────────────────────────────────────────────┐
│ 前端 worker: deepseek-harness-plugin-hub（本仓库）              │
│                                                              │
│  RSC 页面 SSR ──► lib/hub-api.ts ──┐                          │
│  浏览器 fetch /api/* ──► app/api/[...path]/route.ts（代理）─┤  │
│  auth 回调 ──► lib/hub-internal.ts（Bearer 内部端点）      │  │
└──────────────────────────────────────────────────────────────┼─┘
                                                               │ HTTPS
                                                               ▼
┌──────────────────────────────────────────────────────────────┐
│ 后端: dsh-hub-api（Go, Cloud Run, asia-northeast1）            │
│   域名: https://api.dshpluginhub.ai                           │
│   仓库: github.com/pax-beehive/dsh-plugin-hub-api             │
│   GCP 项目: dsh-plugin-hub-mkvoj3                             │
│                                                              │
│  Cloud SQL Postgres（dsh-hub-db / dsh_plugin_hub）            │
│  Cloud Scheduler: npm-sync-schedule 每 6h → /internal/schedule │
└──────────────────────────────────────────────────────────────┘
```

**数据流向铁律：前端不碰数据库。** 所有读写都通过 HTTP API。`app/` 目录下不允许出现 `@/db` import（CI 没有强制检查，code review 时注意）。

## 2. 前端代码结构（切流后）

| 文件 | 职责 |
|---|---|
| `lib/hub-api.ts` | **服务端组件专用**的 API 客户端。7 个类型化函数（`searchPackages`、`getPackageBySlug`、`searchProfiles`、`getProfile`、`listOwnedPlugins`、`getOwnedPlugin`、`listGitHubRepositories`），用 `@dsh-plugin-hub/schemas` 的 zod schema 校验响应。authed 函数自动转发请求 cookie |
| `app/api/[...path]/route.ts` | **统一代理**：浏览器调的所有 `/api/*` 请求原样转发到 `${HUB_API_ORIGIN}/api/*`（流式 body、转发 cookie/origin、剥 hop-by-hop 头）。`HUB_API_ORIGIN` 未配置时返回 503 `hub_api_not_configured` |
| `lib/hub-internal.ts` | auth 回调写库用的内部端点客户端（Bearer `HUB_INTERNAL_TOKEN`）：`upsertHubWorkosUser`、`HttpGitHubClaimStore` |
| `app/callback/route.ts` | WorkOS 登录回调：会话 cookie 仍由前端签发（authkit），用户落库改为调内部端点 |
| `app/integrations/github/oauth/callback/route.ts` | GitHub App 安装回调：OAuth 交互在前端，installation 落库走内部端点 |
| `proxy.ts` | authkit 中间件，保护 `/dashboard`、`/api/v1/manage/*` 等路径，未改动 |

**已删除**：`app/api/v1/**`、`app/api/waitlist/**`、`app/api/admin/**`、`app/api/health` 的全部 route.ts（17 个文件）——它们曾是 TS 后端实现，现在由 Go 服务承载。

**保留但生产不再使用**：`db/`（Drizzle store 实现）、`lib/npm-sync.ts`、`lib/registry-service.ts` 等。它们仍被 `tests/` 下的集成测试和 `scripts/` 运维脚本引用，故未清理。wrangler.jsonc 里的 D1 binding 同理保留。

## 3. 环境变量与密钥

### vars（wrangler.jsonc，非机密）

| 变量 | 生产值 | 说明 |
|---|---|---|
| `HUB_API_ORIGIN` | `https://api.dshpluginhub.ai` | 后端 origin。**本地开发**在 `.env` 设 `http://localhost:8080` |
| `WORKOS_CLIENT_ID` | `client_01M09HAMW290EESBWR59D2EEAP` | WorkOS Production AuthKit client；staging 使用独立 Client ID |
| `NEXT_PUBLIC_WORKOS_REDIRECT_URI` | `https://dshpluginhub.ai/callback` | |
| `GITHUB_APP_ID` / `GITHUB_APP_SLUG` | `4631702` / `pax-dsh-hub` | |
| `GITHUB_REDIRECT_URI` | `https://dshpluginhub.ai/integrations/github/oauth/callback` | |

### secrets（`wrangler secret put`，生产已配置）

- `WORKOS_API_KEY`、`WORKOS_COOKIE_PASSWORD`（**必须与后端 GCP Secret Manager 里的值一致**，cookie 是前端签发、后端解开的）
- `HUB_INTERNAL_TOKEN`（必须与后端 `INTERNAL_TASK_TOKEN` 一致，保护 `/internal/*` 端点）
- `TURNSTILE_SECRET_KEY`、`CLOUDFLARE_*`、`WAITLIST_*`：waitlist 逻辑已迁到后端，前端的这些已无人使用，暂未清理

### ⚠️ 生产缺失

`GITHUB_CLIENT_ID`（staging 是 `Iv23liVukxgp1lfIaSI5`）、`GITHUB_CLIENT_SECRET`（需在 GitHub App 页重新生成）、`GITHUB_OAUTH_STATE_SECRET`（随机串即可）——**dashboard 的 GitHub 连接功能在生产暂不可用**，补了这三个 secret 就好。

## 4. 本地开发

```bash
# 终端 1：起后端（Go 仓库，docker compose 一键起 Postgres + 迁移 + API）
cd ../dsh-plugin-hub-api && docker compose up --build

# 终端 2：起前端（.env 里设 HUB_API_ORIGIN=http://localhost:8080）
pnpm dev
```

前端不设 `HUB_API_ORIGIN` 时所有 `/api/*` 返回 503，这是设计行为。

## 5. 部署

```bash
pnpm deploy:production  # 生产
pnpm deploy:staging     # staging
```

### 部署相关的坑（都踩过，别再踩）

1. **`nodejs_compat` 需要覆盖 build 和 upload 两段**：`vite.config.ts` 的 Cloudflare 插件 config 负责 build；两个 deploy script 通过 `--compatibility-flag nodejs_compat` 负责 Wrangler upload。不要再把它写进 `wrangler.jsonc`，否则 Vite 合并配置时可能重复；upload 漏掉 CLI flag 会报 10021 `No such module node:async_hooks`。
2. **不要在 wrangler.jsonc 里声明生产 routes**：apex `dshpluginhub.ai` 的 custom domain 是通过 Cloudflare API 挂的，zone 里曾有外部 DNS 记录，wrangler 声明 `custom_domain` 会报 100117。当前 wrangler.jsonc 无生产 routes 是对的，deploy 不会动域名。
3. **wrangler 凭证**：`.env` 里的 `CLOUDFLARE_API_TOKEN` 是窄权限 token（只读）。部署/写 secret 需要另一个 token（存在 `dsh-plugin-hub-api/.env.prod`，权限 Workers Scripts:Edit + D1:Edit + Zone DNS:Edit）。OAuth 登录态在 `~/Library/Preferences/.wrangler`，已过期；也可用项目级隔离登录：`WRANGLER_HOME=$PWD/.wrangler-auth npx wrangler login`（目录已 gitignore）。
4. **域名切换后的 1034**：custom domain 刚挂载时边缘节点会短暂返回 403 error code 1034，等 2-5 分钟自愈，不是代码问题。

## 6. 后端协作要点（改 API 时必读）

- **契约**：`api/openapi.yaml`（Go 仓库）。改任何请求/响应形状先改契约，两端同步。
- **CORS/Origin**：后端校验 Origin 白名单（`CORS_ALLOW_ORIGINS=https://dshpluginhub.ai,...`，Cloud Run env）。浏览器请求经前端代理后 Origin 仍是主域名——新增前端域名（如 www）要同步加白名单。
- **内部端点**（`/internal/*`，Bearer token，不在 OpenAPI 里）：`identity/upsert-user`、`identity/save-installation`、`tasks/sync-package`、`schedule`。前端只有 `lib/hub-internal.ts` 会调它们。
- **健康检查**：`GET /api/health` → `{status, database}`（200/503）。
- **manage API 鉴权**：`wos-session` cookie，Go 端用 `WORKOS_COOKIE_PASSWORD` 解 iron-session 封装。改 cookie 密码要前后端同时换。

## 7. 已知遗留

- **waitlist API 退役**：首页表单和 `/unsubscribe` 页面已经移除，但通用 `/api/*` 代理目前仍会把 `/api/waitlist` 转发到 Go API。发布后 TODO：前端对 waitlist 路径返回 `410 Gone`，确认历史数据保留策略后再下线后端端点与旧 secrets/binding。本次 2026-08-20 production 发布明确延后该项。
- **生产 GitHub OAuth**：production Worker 仍缺 `GITHUB_CLIENT_ID`、`GITHUB_CLIENT_SECRET`、`GITHUB_OAUTH_STATE_SECRET`；目录浏览和 WorkOS 登录不受影响，GitHub 认领/连接功能待补齐密钥后验收。
- **waitlist 历史数据**：2 条订阅记录在旧 OpenAI Sites 托管侧的 D1 里（本账号 D1 是空的），未抢救。旧的 2 封欢迎邮件也都是发送失败状态，损失可控。
- **OpenAI Sites 托管已弃用**：apex 已从那边收回。`.openai/hosting.json`、`@openai/sites-vite-plugin` 仍在代码里（vite.config.ts 引用），暂未拆除。
- **`tests/worker-runtime.integration.test.mjs`** 会直打已删除的 `/api/admin/waitlist/stats`，本地无后端时会失败——属已知问题，待改为指向 Go 后端或标记跳过。
- **staging 环境**：staging worker 和 staging D1 保持原状（`deploy:staging` 仍走旧架构的 wrangler 流程），未随生产一起切。
- D1 → Postgres 迁移脚本在 `scripts/migrate-d1-to-pg.mjs`，用法见 `docs/migration-gcp.md` §8（本账号 D1 无数据可迁，脚本已验证可跑）。

## 8. 相关文档

- `docs/migration-gcp.md` — GCP 迁移方案（含数据库方言差异、队列/定时任务映射）
- `docs/handover.md` — 更早的交接文档（staging 时代，部分内容已过时，以本文为准）
- 后端仓库 README — Go 服务的配置和端点说明
