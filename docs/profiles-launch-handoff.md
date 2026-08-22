# Profiles 上线同步报告

最后更新：2026-08-22  
状态：生产可用，已正式开放

## 一句话结论

DSH Plugin Hub 的 Profiles 全链路已经上线。用户可以通过 CLI 分享当前本地 Profile，也可以在 Web Builder 中创建 Profile；公开 Profile 支持搜索、查看、精确版本安装、history 和 rollback。

CLI、前端、后端、npm、Cloud Run、Cloudflare、WorkOS 鉴权和 sitemap 均已完成生产验证，目前没有已知上线阻塞。

## 当前生产版本

| 模块 | 版本或 Revision | 状态 |
| --- | --- | --- |
| CLI | `@dsh-plugin-hub/cli@0.1.3` | npm `latest` |
| 前端 Git | `90a6aae` | 已推送至 `main` |
| Cloudflare Worker | `84813dea-4e94-4f8b-a187-746961a3334c` | 生产运行中 |
| 后端 Git | `04812ba` | 已与 `main` 同步 |
| Cloud Run | `dsh-hub-api-00045-rp8` | 承接 100% 生产流量 |
| 正式 Profile | `dsh-web-workspace@0.1.0` | Public |

生产地址：

- Hub：<https://dshpluginhub.ai>
- Profiles 目录：<https://dshpluginhub.ai/profiles>
- 正式 Profile：<https://dshpluginhub.ai/profiles/dsh-web-workspace>
- API：<https://api.dshpluginhub.ai>
- Sitemap：<https://dshpluginhub.ai/sitemap.xml>

## 产品路径

### Profile 创建

当前支持两条路径：

1. 用户通过 CLI 一键分享已有的本地 DSH Profile。
2. 用户通过 `/dashboard/profiles/new` 在 Web Builder 中创建并发布 Profile。

两条路径最终发布同一种 Profile Release。CLI 提供底层能力，也能通过 `--json` 和 operation plan 被 plugin、skill、agent 或自动化流程调用。

### Profile 使用

用户可以：

- 在 `/profiles` 搜索公开 Profile。
- 在 `/profiles/[slug]` 查看精确版本与加载顺序。
- 使用 CLI 应用指定 Profile Release。
- 查看本地 revision history。
- 回滚到历史 revision。
- 导入便携的 `.dshprofile` 文件。

## CLI

### 已发布命令

```text
dsh-hub profile search <query>
dsh-hub profile capture <slug> --profile <name>
dsh-hub profile share <slug> --version <version> --profile <name>
dsh-hub profile apply <slug> --version <version> --profile <name>
dsh-hub profile import <file.dshprofile>
dsh-hub profile history --profile <name>
dsh-hub profile rollback [revision] --profile <name>
dsh-hub operation apply <plan-id>
```

### 关键保证

- Share 时使用指定的精确 DSH runtime 进行验证。
- CLI 直连 `https://api.dshpluginhub.ai/api/v1`，支持 WorkOS Bearer token。
- 锁定 npm 精确版本或 GitHub commit。
- 保留 bundle 加载顺序。
- 校验 Profile content hash。
- 安装前写入最小化 `pnpm allowBuilds` 策略。
- Operation plan 带前置条件且只能执行一次。
- Profile 替换前保存可恢复 revision。
- 支持机器可读的 JSON 输出。

运行要求：

- Node.js `>=22.13.0`
- `pnpm` 可从 `PATH` 调用

## Profile Release 模型

每个 Profile Release 会记录：

- Profile 精确版本。
- DSH runtime 精确版本。
- 有序 bundles。
- npm 精确版本或 GitHub commit。
- Patch 数据。
- 必需的本地 inputs。
- Content hash。
- Structural 和 composition verification 证据。
- 发布时间。

Hub 上同一个版本发布后保持不可变。本地 apply 会生成 lockfile，并在覆盖现有 Profile 前保存 revision。

## 正式参考 Profile

`dsh-web-workspace@0.1.0` 是当前生产参考 Profile。

| 字段 | 值 |
| --- | --- |
| DSH runtime | `0.1.1-rc.2` |
| Built-in bundle | `@deepseek-ai/dsh-base@0.1.1-rc.2` |
| Built-in bundle | `@deepseek-ai/dsh-web-app@0.1.1-rc.2` |
| Community plugin | `dsh-better-sidebar@0.15.0` |
| Git commit | `f0965e1d6157a3e06ed2f5c7775a64428d5d3c29` |
| Content hash | `sha256:ac88d34a1e82dfc01e6908edb157caee27f4b21e349dc922d9babd864dc043dd` |

旧的 `profile-flow-smoke-test-20260822` 已改为 `unlisted`。它保留直链用于追溯，不会出现在公开目录或搜索结果中。

## 前端

Profiles 已接入：

- 公共 Header。
- Dashboard Header。
- Footer Explore。
- `/profiles` 目录。
- `/profiles/[slug]` 详情页。
- `/dashboard/profiles/new` Web Builder。
- Sitemap。

Profile 详情页会展示 Release 版本、DSH runtime、bundle 顺序、plugin 精确版本、GitHub commit、patch 数量和安装入口。

### Sitemap

Registry 当前包含 4,300 多个插件，因此 sitemap 使用分片结构：

- `/sitemap.xml`：sitemap index。
- `/sitemap/0.xml`：静态页面、Categories 和 `/profiles`。
- `/sitemap/1.xml` 及后续 shards：Plugin 详情 URL。
- 当前 index 覆盖到 `/sitemap/88.xml`。
- 非法 shard 返回 `404`。

未命中的冷请求仍需要数秒读取生产 Registry，后续请求由 Cloudflare 缓存。随着 Registry 增长，需要持续关注冷启动响应时间。

## 后端

Go API 已支持：

- WorkOS Bearer token 鉴权。
- 用户 Profile draft。
- 精确 Profile Release 发布。
- Runtime 与 bundle 解析。
- Release 版本不可变。
- Content hash。
- `public`、`unlisted`、`private` visibility。
- 公开 Profile 搜索与详情。
- `.dshprofile` 下载。
- npm Registry 与 GitHub source ingestion。
- GitHub-discovered plugin screenshots 和 media metadata。

生产 Cloud Run 的 WorkOS Client ID 已修正。真实 CLI access token 已成功通过生产 API 鉴权。

## 验收证据

本次上线通过：

- `210/210` 仓库测试。
- TypeScript typecheck。
- ESLint。
- Vinext production build。
- Cloudflare Worker 部署。
- npm publish 与 `latest` 校验。
- 从 npm 安装 CLI 后对生产 Profile 执行 dry-run。
- 空目录真实安装正式 Profile。
- 重复 apply 并生成 revision。
- History 查询。
- Rollback。
- 正式 Profile API 与页面检查。
- Public/unlisted 搜索可见性检查。
- Sitemap index、静态 shard、Plugin shard 检查。
- 非法 sitemap shard `404` 检查。
- WorkOS CLI Bearer authentication。

## 广告与归因

Profiles 和 sitemap 上线没有改动现有广告机制。生产仍保留：

- Google Analytics。
- Google Ads conversion 配置。
- OpenAI CAPI。
- First-touch attribution cookie。
- `gclid`、UTM、`oppref` 参数保留。
- `copy_install` 转化事件。
- Measurement endpoints 对应的 CSP 配置。

最终完整测试包含广告与归因回归用例，全部通过。

## 以后每次前端部署的门禁

1. 执行 `git fetch origin main`。
2. 比较本地 `HEAD` 和 `origin/main`。
3. 远端领先或双方 diverge 时，先检查 diff 并 catch up。
4. Rebase 或 merge 后重新运行相关测试。
5. 确认工作树干净。
6. 确认本地与远端一致后再部署。
7. 部署完成后执行生产 E2E。

本次最终部署通过该门禁，本地与远端均为 `90a6aae`。

## 后续观察指标

- Profile 发布失败率。
- Profile 安装成功率。
- Local composition verification 失败率。
- Rollback 使用量与失败率。
- WorkOS CLI 鉴权失败率。
- Sitemap 冷请求耗时。
- Sitemap shard 增长速度。
- npm CLI 版本分布与使用量。

## 当前结论

Profiles 已开放给真实用户。CLI、Web、后端、鉴权、Registry 发布、npm 分发、sitemap 和 rollback 路径均已完成生产验证，目前没有已知上线阻塞。
