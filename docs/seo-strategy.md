# DSH Plugin Hub SEO 策略：关键词抢占与页面体系设计

调研时间：2026-08-19
关联文档：[`competitive-analysis.md`](competitive-analysis.md)、[`handover.md`](handover.md)

## 0. TL;DR

「deepseek harness」「dsh」相关的搜索需求正在随官方 developer preview 快速膨胀，但目前**没有任何一家占据绝对 SEO 优势**——官方站只做单页介绍，4 家竞品目录站（dshplugin.dev / .me / .org / deepseekharnessplugins.com）都是最近一周内上线，内容浅、技术 SEO 粗糙。这是一个 3–6 个月的窗口期。

我们的打法分三层：

1. **技术 SEO 补课**（1 周内）：结构化数据、元数据模板、sitemap 修正、llms.txt 更新——全是低成本高确定性的工程改动。
2. **程序化 SEO 页面矩阵**（2–4 周）：把已有的 plugins / profiles / categories 数据变成几百个可被搜索的落地页，每个页面针对一类搜索意图写元数据模板。
3. **内容护城河**（持续）：指南、错误修复长尾页、对比页，中英双语，配合 GEO（AI 搜索优化）让 ChatGPT/Perplexity/DeepSeek 在回答「dsh 插件去哪找」时引用我们。

---

## 1. 现状审计

### 1.1 已有的 SEO 资产（代码确认）

| 资产 | 位置 | 状态 |
|---|---|---|
| 动态 sitemap（含 plugins/profiles/categories/guides） | `app/sitemap.ts` | ✅ 可用，但有缺陷（见 4.3） |
| robots.txt 放行 AI 搜索爬虫（OAI-SearchBot / Claude-SearchBot / PerplexityBot） | `app/robots.ts` | ✅ 超前于竞品 |
| 中英同 URL i18n | ADR 0002 | ✅ 链接稳定，利于分享和收录 |
| 插件/Profile 详情页 `generateMetadata` | `app/(default)/plugins/[slug]/page.tsx` | ⚠️ 有，但标题公式太弱（见 4.1） |
| 5 篇指南（安装失败/版本兼容/HMR/发布搜不到/第一个插件） | `lib/guides.ts` | ⚠️ 方向对，数量太少 |
| llms.txt / llms-full.txt / index.md | `public/` | ❌ **严重过时**：仍写着"pre-release，目录未上线"，会向 AI 爬虫传递错误事实 |
| 分类落地页 | `app/(default)/categories/[category]/` | ⚠️ 有页面，缺内容 |

### 1.2 关键缺口

1. **零结构化数据**：全站没有任何 JSON-LD（SoftwareApplication、FAQPage、BreadcrumbList、ItemList），搜索结果永远是纯蓝链，没有富摘要。
2. **元数据模板未做关键词设计**：插件详情页标题是 `{displayName} — DSH Plugin Hub`，浪费了「DSH plugin」「DeepSeek Harness 插件」这些词。
3. **llms.txt 与现况矛盾**：AI 引擎读到的还是「还没上线」——等于主动放弃 GEO。
4. **内容量不足**：竞品 dshplugin.me 有错误修复页矩阵，dshplugin.dev 有 8 个分类页 + 指南 + FAQ + editorial policy，我们只有 5 篇指南。
5. **无外链策略**：没有任何让 GitHub README、awesome 清单、中文技术社区链接回我们的机制。

---

## 2. 关键词矩阵

按搜索意图分五层。搜索量数据目前无法精确获取（Google Keyword Planner 未接入），分层依据是 2026-08-19 当天的搜索结果密度、竞品页面布局和社区内容（掘金/思否/阿里云开发者/菜鸟教程均已有教程内容，说明中文需求已被验证）。

### 2.1 第一层：品牌词（必须垄断）

| 关键词 | 意图 | 目标页面 |
|---|---|---|
| dsh plugin hub / dshpluginhub | 找我们 | 首页 |
| dsh hub cli / dsh-hub | 找 CLI | 首页 + 指南 |

自有品牌词，上线后自然垄断，不需要额外工作，但要确保 Search Console 里能监测到。

### 2.2 第二层：核心品类词（主战场）

| 关键词（EN） | 关键词（ZH） | 当前竞争格局 | 目标页面 |
|---|---|---|---|
| deepseek harness plugins | deepseek harness 插件 | 4 家竞品目录 + 聚合文章，无官方页面 | `/plugins`（目录首页） |
| dsh plugins | dsh 插件 | 同上 | `/plugins` |
| deepseek harness plugin hub / registry / marketplace | deepseek harness 插件市场 | 几乎无人优化 | 首页 |
| dsh plugin directory | dsh 插件大全 / 插件推荐 | 竞品 + 自媒体文章 | `/plugins` |

**打法**：这类词的决定性因素是「页面本身是不是一个真目录」。Google 对目录类查询偏爱有实质列表内容、持续更新、有内链结构的页面。我们的 `/plugins` 需要：关键词完整的 H1、静态可爬的列表（确认 SSR 输出）、分类内链、收录数量实时展示。

### 2.3 第三层：概念/教程词（内容页承接）

| 关键词 | 意图 | 目标页面 |
|---|---|---|
| what is deepseek harness / deepseek harness 是什么 | 了解概念 | 指南：什么是 DSH |
| deepseek harness tutorial / 教程 / 入门 | 学习使用 | 指南：快速上手 |
| how to install dsh plugin / dsh 插件怎么装 | 安装方法 | 指南：安装插件（含官方命令 + dsh-hub 两种方式） |
| dsh profile / dsh profile 配置 / bundle / patch | 理解装配系统 | **这是我们独有的词**：`/profiles` + 指南：Profile 是什么 |
| dsh plugin development / 开发 dsh 插件 | 开发者 | 指南：写你的第一个插件（已有，需扩写）+ publishing 指南 |
| deepseek harness vs claude code / vs codex | 选型对比 | 对比页（见 3.4） |

**关键洞察**：「dsh profile」这个词目前几乎只有官方文档和一两篇掘金源码解读在覆盖，而**我们是全生态唯一有公开 profile 目录的站**（`/profiles` + `dsh-hub profile apply`）。这是最容易抢到第一的词群，竞品都没有对应页面。

### 2.4 第四层：类目长尾词（程序化页面）

每个插件类目都是一组词，例如：

| 类目 | 英文词 | 中文词 |
|---|---|---|
| 主题/皮肤 | dsh theme / dsh skin plugin | dsh 主题 / dsh 皮肤插件 |
| TUI/终端 | dsh tui / deepseek harness terminal | dsh 终端界面 |
| 视觉 | dsh vision plugin / dsh ocr | dsh 视觉插件 / 识图 |
| 记忆 | dsh memory plugin | dsh 记忆插件 |
| 桌面端 | deepseek harness desktop app | dsh 桌面版 / 客户端 |
| 余额/成本 | dsh token usage / cost monitor | dsh 余额查询 / token 统计 |

**打法**：`/categories/[category]` 页面升级为真正的落地页（见 3.2），每类一段人工写的导语 + 该类插件列表 + FAQ。

### 2.5 第五层：错误/问题长尾词（精准获客）

用户装插件踩坑时搜的是报错原文。竞品 dshplugin.me 已验证这个策略。候选词（来自社区issue、掘金评论区、官方 repo issues）：

- `ERR_PNPM_IGNORED_BUILDS` dsh
- dsh plugin add not working / dsh 插件安装失败
- cordis startup failed / dsh 启动失败
- dsh 端口 3080 打不开 / localhost:3080 blank
- dsh HMR not working（已有指南）
- dsh version incompatible（已有指南）
- dsh profile not found / profile 初始化失败
- dsh web ui 中文乱码 / 白屏

**打法**：每篇一个 `/guides/[slug]`，标题即报错原文，结构 = 报错现象 → 原因 → 分步修复 → 相关插件推荐（导回目录）。中英双语。已有 5 篇中的 4 篇属于此类，扩展到 15–20 篇。

### 2.6 不抢的词

- **「deepseek」裸词**：大词，官方和模型相关内容垄断，与我们无关的意图太多，不投入。
- **「harness」裸词**：与 Harness.io（CI/CD 公司）撞车，无法赢。
- 官方文档明确覆盖且持续更新的命令参考类内容（我们做「入口和导读」，不做「文档镜像」）。

---

## 3. 页面架构设计

### 3.1 插件详情页 `/plugins/[slug]`（数量最大的页面群，优先改）

当前标题公式：`{displayName} — DSH Plugin Hub`

改为：

```
EN: {displayName} — DSH Plugin for DeepSeek Harness | DSH Plugin Hub
ZH: {displayName} — DeepSeek Harness 插件（DSH Plugin）| DSH Plugin Hub
```

描述公式：

```
{summary} Install with: dsh plugin --profile web add {package}@{version}.
Verified manifest, exact versions, integrity-checked.
```

页面本体增强：

- **H1** 用 displayName，副标题带上 "DeepSeek Harness plugin"。
- **JSON-LD `SoftwareApplication`**：name、description、softwareVersion、author、dateModified、installUrl、applicationCategory。
- **FAQ 块 + FAQPage JSON-LD**：每页自动生成 2–3 条（怎么安装、兼容哪个 dsh 版本、支持 HMR 吗），答案从 manifest 数据生成——零人工成本。
- **「同类插件」内链模块**：同 category 的 3–5 个插件，既提权也降低跳出。
- 面包屑 `首页 / Plugins / {category} / {name}` + BreadcrumbList JSON-LD。

### 3.2 分类页 `/categories/[category]`

当前只有列表。升级为：

- H1：`{Category} DSH Plugins` / `DeepSeek Harness {类目}插件`
- 150–300 字人工导语（每类写一次，8–10 个类目一次性工作量可控）：这个类目解决什么问题、怎么选、安装注意事项。
- 插件列表（SSR 可爬）。
- 3 条 FAQ + JSON-LD。
- ItemList JSON-LD（类目内插件清单）。

### 3.3 Profile 页 `/profiles` + `/profiles/[slug]`（差异化独占）

全网没有第二家有公开的 DSH profile 目录。页面要点：

- `/profiles` 首页针对 "dsh profile" / "deepseek harness profile" 优化，H1 + 一段解释「profile 是什么」的导语（蹭概念词的流量，导流向具体 profile）。
- 详情页标题公式：`{name} — DSH Profile（{bundleCount} 个插件组合）| DSH Plugin Hub`，附 `dsh-hub profile apply` 一键命令。
- 配套指南：《DSH Profile 是什么？Bundle / Patch / Profile 一篇讲清》——这个词群（见 2.3）我们天然有资格排第一。

### 3.4 新增页面类型

| 页面 | 路径建议 | 目标词 | 工作量 |
|---|---|---|---|
| FAQ 总页 | `/faq` | deepseek harness plugins faq 等杂词收口 | 小 |
| 对比页 | `/guides/dsh-vs-claude-code`、`/guides/dsh-vs-codex` | 选型词，搜索者是高价值开发者 | 中（需认真写，保持客观） |
| 错误修复页 ×10–15 | `/guides/{slug}` | 2.5 节词群 | 中（模板化生产） |
| 概念指南 ×4–6 | `/guides/{slug}` | 2.3 节词群 | 中 |
| 安全立场页 | `/security`（或 guide） | dsh plugin safety / 插件安全吗 | 小（素材在 handover 里） |
| 收录动态页 | `/status` 已有 | 无直接搜索价值，但是新鲜度信号 + 爬虫入口 | 已有，补 sitemap 即可 |

### 3.5 内链结构

```
首页
 ├── /plugins（每个详情页回链所属分类）
 │    └── /plugins/[slug] ←→ 同类插件互链
 ├── /categories/[category] → 链向类目下全部插件
 ├── /profiles → /profiles/[slug]
 ├── /guides → 每篇指南底部「相关插件」导回目录
 └── /faq → 链向指南和目录
```

原则：任何插件详情页到首页不超过 2 跳；每篇内容页至少 3 个指向目录页的内链（把内容页获得的权重导回商业页面）。

---

## 4. 技术 SEO 清单

### 4.1 元数据（改 `app/(default)/layout.tsx` 与各页 generateMetadata）

- 首页标题改为包含核心词：`DeepSeek Harness Plugin Hub — DSH 插件目录与安装社区`（EN 版本：`DSH Plugin Hub — DeepSeek Harness Plugins, Profiles & Guides`）。
- 所有页面补 `alternates` 与 canonical（当前中英同 URL，canonical 指向自身即可，无需 hreflang 对）。
- OG 图：确认 `og-v2.png` 被实际引用，为插件详情页考虑动态 OG 图（Cloudflare Worker 可用 `@cf` 图像绑定或预生成，非必须，P2）。

### 4.2 结构化数据（全站新增，P0）

| 页面 | JSON-LD 类型 |
|---|---|
| 首页 | WebSite + Organization（含 `sameAs` GitHub） |
| /plugins | CollectionPage + ItemList |
| /plugins/[slug] | SoftwareApplication + BreadcrumbList + FAQPage |
| /profiles/[slug] | SoftwareApplication（或 ItemList of bundles）+ BreadcrumbList |
| /categories/[x] | CollectionPage + ItemList + FAQPage |
| /guides/[slug] | Article/TechArticle + BreadcrumbList（错误页可用 FAQPage） |
| /faq | FAQPage |

实现建议：写一个 `lib/structured-data.tsx` 集中生成，在 layout/页面注入 `<script type="application/ld+json">`，用 Google Rich Results Test 逐模板验证。

### 4.3 Sitemap 修正（`app/sitemap.ts`）

- `searchPackages("", { limit: 100 })` 有上限——收录量超过 100 后插件会从 sitemap 消失，**必须分页全量输出**（这是当前最紧急的技术 bug 之一）。
- 补 `/status`、`/faq`、分类页 lastModified。
- guides 的 changeFrequency 从 monthly 改为 weekly（我们会持续更新）。

### 4.4 llms.txt 更新（`public/`，P0，半天工作量）

当前版本说「目录未上线」，必须重写为：

- 目录已上线，列出 `/plugins`、`/profiles`、`/categories`、`/guides` 的 Markdown 入口；
- 每个插件详情页建议提供 `.md` 版本（成本极低：把 manifest 数据渲染成 Markdown 加一条路由），AI 引擎引用时体验远好于 HTML；
- 保持「独立非官方」声明（这也是 AI 引擎区分我们和官方、避免错误归因的关键）。

### 4.5 渲染与性能

- 确认 `/plugins` 列表 SSR 输出完整 HTML（vinext/Worker 下应该没问题，但值得爬一遍自己的站验证：关 JS 抓首页和详情页，看正文是否在 HTML 里）。
- Cloudflare Worker 边缘渲染天然 TTFB 好，保持；注意截图/OG 图的尺寸压缩。
- 列表页分页用真链接（`?page=2` 可爬），不要纯客户端加载更多。

### 4.6 监测基础设施

- Google Search Console + Bing Webmaster Tools 上线即接入（Bing 对 ChatGPT/Copilot 的检索有直接影响， GEO 的一部分）。
- 建关键词排名追踪表（2.2–2.5 的词，每周记录）。
- Search Console 的「查询」报告每月反哺内容选题——真实搜索词比任何工具都准。

---

## 5. 内容策略

### 5.1 内容生产优先级

按「流量确定性 × 生产成本」排序：

1. **错误修复页**（2.5）：模板化、双语、需求刚性，每篇 1–2 小时。
2. **类目导语**（3.2）：8–10 篇短导语，一次性。
3. **概念指南**（2.3）：Profile/Bundle 那篇最优先，独占词。
4. **对比页**（3.4）：慢工出细活，但被引用价值最高（AI 引擎特别喜欢引用客观对比内容）。
5. **版本/生态动态**：DSH 官方发新版、收录里程碑（"收录突破 500"）等，短平快，喂新鲜度信号，也给外链提供由头。

### 5.2 双语策略

ADR 0002 的同 URL i18n 对 SEO 是双刃剑：链接集中权重，但 Google 对单 URL 双语言的内容识别不如分 URL 稳定。建议：

- 指南和落地页的 `<html lang>`、title、description 随请求语言正确切换（确认已实现）；
- 观察 Search Console 中 zh/en 查询的收录情况，若英文指南长期不收录，再评估是否拆 `/en/` 路径（当前有 `app/(english)/en/route.ts`，改起来有基础）。
- 中文词群优先级不低于英文：DSH 社区中文用户占比极高（看竞品收录的插件名就知道），且中文竞品内容普遍更弱。

### 5.3 内容原则

- 每篇内容必须给出**精确命令和版本号**（我们的差异化：精确版本 + integrity），这正是 AI 引擎和开发者都偏爱的「可执行答案」。
- 保持独立非官方声明的可见性——信任信号，也规避商标风险。
- 不堆砌关键词；标题公式里的关键词密度已经足够。

---

## 6. 外链与分发

新站最大的短板是域名权重。按成本排序：

1. **listing badge**（抄 dshplugin.dev）：给作者一个 "Listed on DSH Plugin Hub" 徽章，嵌入 GitHub README → 每个收录作者都给我们一条 GitHub 外链。README 里同时自然出现 "DeepSeek Harness plugin" 锚文本。成本：一张 SVG + dashboard 里一段复制代码。
2. **awesome 清单**：向 `awesome-deepseek-harness-plugins` 等社区清单提 PR 收录 Hub。
3. **官方 GitHub Discussion**：在 RFC #1846 等讨论中以「registry 实现方」身份专业发声（也服务于 C2 卡位目标），profile 链接带回。
4. **中文社区**：掘金/思否/公众号发 2–3 篇「DSH 插件生态观察」「怎么发布一个 DSH 插件」深度文，文末挂 Hub。这些站域名权重高，且中文 SERP 里它们经常占位——与其竞争不如借它们做引用。
5. **Open source 策略**：考虑把 `packages/schemas` 或 CLI 的文档站外化一部分（如 GitHub Pages），增加可信外链面。

---

## 7. GEO（AI 搜索优化）

DSH 的用户群（开发者）用 AI 搜索的比例远高于普通网民，GEO 对这个站不是可选项：

- **robots 已放行 AI 爬虫**（已做，领先竞品）。
- **llms.txt 修正**（4.4，最优先）。
- **可引用的事实块**：每篇指南开头放一段「TL;DR + 精确命令」，AI 引擎摘录时直接可用。
- **结构化 FAQ**：FAQPage JSON-LD 同时服务 Google 富摘要和 AI 引用。
- **被引监测**：定期在 ChatGPT/Perplexity/DeepSeek 里问「deepseek harness 插件去哪找」「dsh profile 怎么配」，记录是否引用我们及引用是否准确；若出现事实错误（如把我们说成官方），用 llms.txt 和首页措辞修正。
- **专有概念定义权**：抢先发布「DSH Profile」「dsh bundle」等概念的权威解释页——AI 引擎倾向引用定义最清晰、结构化最好的来源。

---

## 8. 排期与验收

### Phase 1：技术补课（第 1 周）

| # | 事项 | 验收 |
|---|---|---|
| 1.1 | sitemap 分页全量化（修 bug） | sitemap 包含全部收录插件 |
| 1.2 | llms.txt / llms-full.txt / index.md 重写 | 与线上能力一致 |
| 1.3 | 首页 + 详情页元数据模板改造 | 查看源码确认 title/description |
| 1.4 | JSON-LD：WebSite/SoftwareApplication/Breadcrumb/FAQ | Rich Results Test 通过 |
| 1.5 | 接入 Search Console + Bing WMT | 能看到抓取数据 |

### Phase 2：页面矩阵（第 2–4 周）

| # | 事项 | 验收 |
|---|---|---|
| 2.1 | 分类页导语 + FAQ × 8–10 类 | 上线并被收录 |
| 2.2 | Profile 概念指南 + /profiles 优化 | "dsh profile" 进前 20 |
| 2.3 | 错误修复页 × 10（双语） | 上线，GSC 有展现 |
| 2.4 | /faq 页 | 上线 |
| 2.5 | listing badge + awesome PR | 获得首批外链 |

### Phase 3：内容深化（第 2 个月起）

| # | 事项 | 验收 |
|---|---|---|
| 3.1 | 对比页 × 2（vs Claude Code / vs Codex） | 被 AI 引擎引用 |
| 3.2 | 错误页扩到 20 篇，按 GSC 真实查询选题 | 长尾词持续进流量 |
| 3.3 | 生态动态内容节奏（每官方版本 1 篇） | 新鲜度信号稳定 |
| 3.4 | 中文社区深度文 × 2–3 | 获得高权重引用 |

### 核心指标

| 指标 | 4 周目标 | 3 个月目标 |
|---|---|---|
| GSC 收录页面数 | 100+ | 500+（随收录量增长） |
| 「dsh profile」排名 | 前 20 | 前 3 |
| 「deepseek harness plugins / dsh 插件」排名 | 前 30 | 前 10 |
| 自然搜索点击/周 | 有基线 | 10× 基线 |
| AI 引擎引用（人工抽查） | llms.txt 生效 | 核心问题被引用且事实正确 |

---

## 9. 风险与边界

- **商标风险**：域名和页面大量使用 "DeepSeek"，必须保持「独立非官方」声明的显著性（当前已做，内容页同样适用），不暗示官方身份。
- **官方收编风险**（RFC #1846）：若官方推出自家 registry 页面，品类词竞争会加剧。对冲手段就是 2.3/2.5 的长尾内容和 GEO 定义权——官方不会做错误修复页和社区生态内容。
- **DSH 本身在 developer preview**：搜索量随官方节奏波动，内容里注意标注对应 dsh 版本号（这本身也是长尾词来源，如 "dsh 0.1.0-rc.6"）。
- **不做的事**：不买链、不做采集/机翻内容、不堆砌关键词页（ doorway pages 会被 Google 惩罚且损害社区信任）。

---

*证据来源：2026-08-19 关键词搜索结果（含竞品 dshplugin.dev/.me/.org、deepseekharnessplugins.com、掘金/思否/阿里云/菜鸟教程内容生态）、本仓库代码审计（app/、lib/、public/）。*
