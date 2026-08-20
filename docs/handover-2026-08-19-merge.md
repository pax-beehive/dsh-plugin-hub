# Handover 2026-08-19：前后端解耦 merge（Phase A+B × decoupling）

> 面向：接手本仓库的工程师和 AI agent。
> 前置阅读：[`decoupling-handoff.md`](decoupling-handoff.md)（架构总览与部署坑，**以它为准**）。
> 本文只记录 merge `origin/main`（前后端解耦）与 Phase A+B（`handover-2026-08-19.md` 上半部分）时的取舍。

## 1. Merge 结果

- Merge commit：`d0299ae`（在 `feat/plugin-hub-mvp` 分支上，尚未 push）。
- 原则：**架构听对方的**（前端不碰数据库，全走 `lib/hub-api.ts` → Go 后端）；**功能能保则保**，后端缺能力的全部做成优雅降级。
- 验证：`pnpm check` 111 pass / 0 fail / 1 skip（skip 的是对方 handoff §7 已标注的 worker-runtime 集成测试，已加注释说明）。

## 2. 各项功能现状

| 功能 | 状态 | 说明 |
|---|---|---|
| 前端设计覆盖层 | ✅ 完整保留 | `globals.css` 尾部约 900 行覆盖层原样保留 |
| `/guides` 5 篇中英指南 | ✅ 完整保留 | 纯内容页，零数据依赖 |
| `/report` 页面 + 表单 | ⚠️ 降级 | 页面在；提交走 `/api/report` 代理，**Go 后端暂无此端点**会失败 |
| `/plugins` 编号分页+排序 | ⚠️ 降级 | 前端发 `page/sort` 参数；后端响应带 `total` 时自动点亮编号分页，否则单页渲染 |
| `/plugins` source-only 区块 | ⚠️ 降级 | 调 `/api/v1/source-listings`，404/错误时区块不渲染 |
| 分类 rail + `/categories/[c]` | ⚠️ 降级 | 调 `/api/v1/categories` 与 `category` 透传参数，失败时 rail 隐藏 |
| 详情页 GitHub stars 芯片 | ⚠️ 降级 | schema 的 `github` 可选字段已保留；后端返回即显示 |
| `/status` 页 | ⚠️ 降级占位 | 调 `/api/v1/status`；不存在时渲染空态占位，URL 保留 |
| 动态 sitemap / robots | ✅ 保留 | `app/sitemap.ts` 改走 hub-api（懒加载避免 vinext 急切求值问题），API 不可达时回退到静态路由清单；`robots.ts` 合并了对方的 AI 爬虫规则 |
| GitHub topic 发现 cron | ❌ 待移植 | 参考实现保留在 `lib/github-discovery.ts` + `db/github-source-store.ts`（101→111 测试仍覆盖）；需迁到 Go 后端 Cloud Scheduler |
| abuse report 存储 | ❌ 待移植 | 参考实现保留在 `lib/abuse-report-service.ts` + `db/abuse-report-store.ts`（含 10 个测试）；`app/api/report/route.ts` 已删 |
| `/plugins` `searchPage` store 方法 | 保留在 db/ | `db/registry-store.ts` 未删，Go 移植分页逻辑时可对照 |

## 3. Go 后端需求清单（dsh-plugin-hub-api）

按优先级。契约改动请先改 `api/openapi.yaml`。

1. **`GET /api/v1/packages` 加分页**：`page`、`sort`（`popular`=stars 倒序 / `updated` / `name`）、`category` 参数；响应加 `total: number`。前端已透传，响应 schema 的 `total` 是 optional，加了即点亮编号分页。
2. **`GET /api/v1/status`**：`{summary: [{status, count}], recent: [{packageName, status, packageKind, lastSyncedAt, lastError}], sourceOnlyCount}`。前端 zod 契约见 `lib/hub-api.ts` `syncStatusSchema`。
3. **`GET /api/v1/categories?limit=`**：`{items: [{name, count}]}`。
4. **`GET /api/v1/source-listings?q=&limit=`**：`{items: [{fullName, description, stars, language, license, pushedAt}]}`。依赖 #5 的数据。
5. **GitHub topic 发现**：把 `lib/github-discovery.ts` 的逻辑搬进 Cloud Scheduler 触发的 `/internal/schedule`：搜 `topic:dsh-plugin` / `topic:deepseek-harness`，每 topic 每轮最多 3 页，游标存库，403/429 暂停下轮续爬；`relinkAcceptedPlugins` 把发了 npm 的仓库升级为正式收录。staging D1 里已有 397 条参考数据。
6. **`POST /api/report`**：字段 `{packageName?, reportedUrl?, category, description, reporterEmail?, turnstileToken}`；category 枚举 `malicious_code|copyright|security|spam|other`；需要 Turnstile 验证（action=`report`）+ IP/邮箱 rate limit + honeypot（`website` 字段）。参考 `lib/abuse-report-service.ts`。
7. **包记录加 `github: {stars, pushedAt?}`**：`pluginRecordSchema` 已有 optional 字段，后端 LEFT JOIN source listings 填充即可。

## 4. 部署注意

- **staging 前端现在指向生产 API**（`HUB_API_ORIGIN=https://api.dshpluginhub.ai`，对方配置）。staging 的 D1/Queue/cron triggers 已从 wrangler.jsonc 移除，staging D1 里的 397 条 GitHub 发现数据不再被读取（可用 `scripts/migrate-d1-to-pg.mjs` 迁到 Cloud SQL）。
- merge 后首次部署 staging：`pnpm deploy:staging` 即可，无需 migration（D1 已闲置）。
- `nodejs_compat` 只能写在 vite.config.ts（对方已修，wrangler.jsonc 里不能再写）。
- 对方 handoff §5 的坑全部适用于本分支。

## 5. 回滚

- 整体回滚：`git revert -m 1 d0299ae` 回到 Phase A+B 旧架构（staging D1 数据还在）。
- 单项功能回滚：降级设计保证后端缺能力时页面只是少功能，不会报错。
