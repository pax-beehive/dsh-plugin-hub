# DSH Plugin Hub 竞品分析与追赶计划

调研时间：2026-08-18（基于当日抓取的各站首页与公开搜索结果）
关联文档：[`handover.md`](handover.md) 的「下一步优先级」

## 0. TL;DR

过去约一周内，DSH 插件目录赛道同时出现了 4+ 家竞品，官方仓库 Discussion #1846 还有人在推 registry contract v2 试图被上游收编。竞品清一色走 **GitHub topic 爬虫 + 只读目录 + 内容/SEO 营销** 路线，收录量已达 900–1,150+，而我们的 npm manifest 准入路线收录量小、但拥有它们都没有的**版本、integrity、安装协议和作者工作流**。追赶策略：**吸收它们的发现量与信任信号，用我们的安装链路做差异化收口**。

## 1. 竞品全景

| 站点 | 收录量 | 发现机制 | 准入门槛 | 安装能力 | 特色 |
| --- | --- | --- | --- | --- | --- |
| `dshplugin.dev` | 1,152 repos / 63k stars | GitHub `dsh-plugin` topic + awesome 清单，每日爬取 | 无（topic 即收录） | 无，跳转 GitHub | 内容营销最完整：分类落地页、指南、FAQ、editorial policy、media kit、listing badge |
| `dshplugin.me` | 907 plugins / 扫描 8,133 repos | GitHub topic 扫描 + 插件确认分类 | 「确认为插件」的过滤 | 展示精确 install 命令 | 安全叙事（"A DSH plugin runs as you"）、license/last-commit/maintainer 信号、**错误修复 SEO 页**、**dsh-plugin-radar 站内发现+安全扫描插件**、快照日期透明 |
| `dshplugin.org` | 114 discovered / 6 installable bundles | topic + awesome 清单，定时扫描 | `dsh.bundle.patch` 结构校验 | commit-pinned install 命令 | **开源（MIT）**、5 语言 UI、D1 投稿 + **abuse report**、Cloudflare Access moderation UI |
| `dshplugin.app` | 未公开 | Registry + publication 质量门 | repository identity、bundle 分类、来源证据、install 信息、内容就绪度 | 有 Registry detail 页 | 质量门思路与我们最接近 |
| 官方 RFC #1846 | 536 plugins / 20 verified | registry contract v2 提案 | contract v2 + validator CI | `dsh plugin check` / `dsh doctor` 提案 | **威胁最大**：若被官方收编，所有第三方目录被降维 |
| 我们 `dshpluginhub.ai` | Staging 刚起步 | npm keywords（3 个 query，轮转前 1,000 条） | `dsh.bundle`/`dsh.profile` manifest 准入 | **官方 CLI 精确版本安装 + integrity + lockfile** | 唯一有真安装协议、不可变版本、作者 claim 工作流的 |

## 2. 竞品可取的、我们缺失的

按「追赶价值 / 实现成本」排序：

### 2.1 发现量（最大差距）

- 竞品从 GitHub topic 爬，长尾巨大（dshplugin.dev 1,152；dshplugin.me 扫了 8,133 个 repo 确认 907 个）。**绝大多数社区插件只有 GitHub 仓库，没有发 npm**——我们纯 npm 关键词发现天然漏掉这批。
- **我们缺**：GitHub-source 发现通道。设计上不需要妥协准入：GitHub 发现的 repo 可以作为 candidate，提示作者「补 `dsh.bundle` manifest + 发 npm 即可收录」，把目录流量转化为 npm 发布量——这反而强化我们的 npm 准入标准。

### 2.2 信任信号展示

- dshplugin.me 每个 listing 展示 **license、last commit、maintainer activity**；dshplugin.dev 展示 stars、更新时间、语言。
- **我们缺**：listing 页只有 manifest 元数据，没有 GitHub 侧信号（stars、pushed_at、license、issue 数）。这些数据我们 claim 流程已经接了 GitHub API，补齐成本低。

### 2.3 内容与 SEO 层

- 竞品都有：分类落地页（dshplugin.dev 8 个分类页）、指南（build/install）、FAQ、editorial policy。
- dshplugin.me 的**错误修复页**最聪明：`ERR_PNPM_IGNORED_BUILDS`、"Cordis startup failed"、"dsh plugin add not working" 等长尾搜索词页面——用户在装插件踩坑时搜的就是这些词，这是精准获客入口。
- **我们缺**：全部。目前站点只有目录和详情页。

### 2.4 站内（in-harness）分发

- dshplugin.me 有 **dsh-plugin-radar**：在 DSH 里对话式搜索目录、安全扫描后安装。dshplugin.dev 目录里也有多个第三方 in-GUI marketplace 插件（dsh-market、dsh-webui-market-plugin 等）说明这个形态被验证。
- **我们缺**：我们有 Registry API 和 `dsh-hub` CLI，但没有「在 DSH 里跑」的插件形态。**这是分发的胜负手**：用户在 DSH 里发现插件的转化率远高于网站。我们自己有 API，做一个官方 market 插件是顺势的。

### 2.5 安全叙事与 moderation

- dshplugin.me 把「插件能读你所有文件」作为首页第一屏；dshplugin.org 有 abuse report + Access 保护的 moderation UI。
- **我们缺**：abuse report 入口、公开的安全审查立场页。我们的 handover 安全边界写得很全（tarball origin 校验、allowlist 重建、rate limit），但**没有对外呈现**——安全做了但没变成用户可感知的信任。

### 2.6 透明度与排名方法论

- dshplugin.me 标注「Catalog snapshot 2026-08-18」；生态里有 dsh-recommend 这种「公开评分模型」插件。
- **我们缺**：收录/同步状态对访客不可见（只有作者 dashboard）。一个公开的 sync status / 最近收录动态页成本很低。

## 3. 我们的优势（竞品短期抄不走的）

1. **真安装协议**：`npx @deepseek-ai/dsh plugin --profile web add package@exact-version`，精确版本 + integrity 校验 + `dsh-hub` CLI lockfile + profile apply。竞品全部止步于「跳回 GitHub」或展示命令文本。
2. **不可变版本与 yanked 语义**：`(package, version)` 收录后不可变；npm 删版我们保留并标记。这是供应链可信度的根基，爬虫目录做不到。
3. **manifest 准入即质量门**：`dsh.bundle`/`dsh.profile` 是机器可验证的安装能力证明，比「打了 topic」强一个量级。dshplugin.app 的质量门思路验证了这个方向。
4. **作者工作流**：WorkOS 登录 + GitHub App claim + Dashboard 编辑。竞品里只有 dshplugin.org 有投稿，且没有 claim 模型。
5. **中英同 URL i18n**（ADR 0002）：链接稳定，对中文社区友好（DSH 社区中文占比极高，看竞品收录列表可知）。
6. **可移植架构**（ADR 0001）：schemas/registry/cli 是独立包，官方若推 contract v2，我们可以最快适配。

## 4. 追赶计划（对 handover 优先级的修订建议）

### Phase A：补发现量与信任信号（1–2 周，最高优先）

| # | 事项 | 对应差距 |
|---|---|---|
| A1 | **GitHub topic 发现通道**：新增 discoverer 爬 `dsh-plugin` topic + awesome 清单，入 `npm_sync_packages` 同款状态机；无 npm package 的 repo 标记 `source-only` listing + 引导作者发 npm | 2.1 |
| A2 | listing 页补 GitHub 信号（stars、pushed_at、license、open issues），claim 后每日刷新 | 2.2 |
| A3 | 分类落地页 + sitemap 补齐（复用现有分类元数据） | 2.3 |
| A4 | 公开 sync 状态/最近收录页（复用 `npm_sync_packages` 只读视图） | 2.6 |

### Phase B：内容与安全外化（2–4 周）

| # | 事项 | 对应差距 |
|---|---|---|
| B1 | 指南页：install / build / publish（publishing.md 已有素材，翻译成面向用户的指南） | 2.3 |
| B2 | **错误修复长尾页** 5–10 篇（ERR_PNPM_IGNORED_BUILDS、plugin failed to load、profile 相关），中英双语 | 2.3 |
| B3 | 安全立场页 + abuse report 端点（D1 一张表 + Turnstile，已有 waitlist rate-limit 模式可复用） | 2.5 |

### Phase C：站内分发（1 个月内，战略级）

| # | 事项 | 对应差距 |
|---|---|---|
| C1 | **官方 market 插件**：DSH 插件形态，消费我们自己的 Registry API，搜索 + 详情 + 一键调官方 CLI 安装。我们自己发 npm，顺便成为 Hub 的第一个标杆 listing | 2.4 |
| C2 | 跟踪官方 RFC #1846：评估 contract v2 与 `packages/schemas` 的兼容层，必要时在 Discussion 里发声卡位 | 官方收编风险 |

### 明确不做

- 不做纯 GitHub 安装（无 integrity 保证，违背我们的核心立场）
- 不做机器翻译作者内容（保持 handover 既定边界）
- 不做 popularity 排行榜当默认排序（可以展示 stars，但默认排序应偏「最近验证可装」）

## 5. 验证指标

- 收录量：2 周内 source-only + npm 合计达到 300+（竞品的 1/3）
- A1 上线后 npm 转化率：source-only 作者补 manifest 发 npm 的比例
- B2 页面自然搜索流量（Search Console）
- C1 插件周安装数

---

*证据来源：2026-08-18 抓取 dshplugin.dev / dshplugin.me 首页全文；dshplugin.org / dshplugin.app / RFC #1846 来自当日搜索结果摘要，细节以各站实况为准。*
