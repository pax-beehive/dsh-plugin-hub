export type HubLocale = "zh" | "en";

export const HUB_LOCALE_COOKIE = "dsh-hub-locale";

export const localeTags: Record<HubLocale, "zh-CN" | "en"> = {
  zh: "zh-CN",
  en: "en",
};

export function parseHubLocale(value: unknown): HubLocale {
  return value === "en" ? "en" : "zh";
}

function isChineseLanguageTag(tag: string): boolean {
  const normalized = tag.trim().toLowerCase();
  return normalized === "zh" || normalized.startsWith("zh-");
}

export function localeFromAcceptLanguage(header: string | null | undefined): HubLocale {
  if (header == null || header.trim() === "") {
    return "en";
  }

  const entries = header.split(",").flatMap((part, index) => {
    const segments = part.trim().split(";");
    const tag = segments[0]?.trim() ?? "";
    if (!tag) {
      return [];
    }

    let q = 1;
    for (const param of segments.slice(1)) {
      const [key, raw] = param.split("=");
      if (key?.trim().toLowerCase() === "q" && raw != null) {
        const parsed = Number(raw.trim());
        if (!Number.isNaN(parsed)) {
          q = parsed;
        }
      }
    }

    return [{ tag, q, index }];
  });

  if (entries.length === 0) {
    return "en";
  }

  entries.sort((left, right) => right.q - left.q || left.index - right.index);
  return isChineseLanguageTag(entries[0].tag) ? "zh" : "en";
}

export function resolveHubLocale(cookie: unknown, acceptLanguage?: string | null): HubLocale {
  if (cookie === "en" || cookie === "zh") {
    return cookie;
  }
  return localeFromAcceptLanguage(acceptLanguage);
}

export const hubCopy = {
  zh: {
    languageName: "中文",
    alternateLanguageName: "EN",
    nav: {
      plugins: "Plugins",
      profiles: "Profiles",
      categories: "分类",
      docs: "文档",
      signIn: "登录",
      publish: "发布",
    },
    common: {
      search: "搜索",
      claimed: "已认领",
      viewSource: "查看源码 ↗",
      homepage: "项目主页 ↗",
      reportIssue: "报告问题",
      unavailable: "未提供",
      undeclared: "未声明",
    },
    plugins: {
      title: "发现可验证的 DSH Plugins",
      intro: "查看版本、兼容范围、HMR 行为、源码和精确安装命令。",
      searchLabel: "搜索插件",
      searchPlaceholder: "搜索名称、功能或关键词",
      all: "全部 Plugins",
      result: (query: string) => `“${query}” 的结果`,
      count: (count: number) => `${count} 个`,
      emptyTitle: "暂时没有匹配项",
      emptyBody: "换个关键词，或提交一个 npm 包进行验证。",
      emptyAction: "前往发布控制台",
      description: "说明",
      versions: "版本",
      showMoreVersions: (count: number) => `查看其余 ${count} 个版本`,
      hideVersions: "收起版本",
      latest: "最新版",
      unpackedSize: "解包体积",
      fileCount: "文件数",
      license: "许可证",
      source: "发布源",
      hmr: {
        full: "即时生效",
        config: "重新组合配置",
        refresh: "刷新页面",
        restart: "重启进程",
      },
      treeShaking: {
        false: "已声明 sideEffects: false",
        files: "按文件声明 side effects",
        unknown: "未声明可安全裁剪",
      },
      sourceOnlyTitle: "GitHub 上的社区插件",
      sourceOnlyIntro:
        "这些仓库带有 DSH 生态 topic，但作者尚未发布 npm 包。发布带 manifest 的 npm 包后，将升级为可验证收录并获得精确安装命令。",
      sourceOnlyBadge: "GitHub 源",
      sourceOnlyCta: "查看仓库",
      lastPush: "最近提交",
      weeklyDownloads: "周下载",
      weeklyDownloadsTitle: "npm 周下载量",
      securityPassed: "扫描通过",
      securityPassedTitle: "当前 latest 版本已通过静态安全扫描",
      updatedLabel: "更新于",
      nextPage: "下一页",
      prevPage: "上一页",
      firstPage: "返回第一页",
      totalCount: (count: number) => `共 ${count} 个`,
      sortLabel: "排序",
      sortPopular: "热门",
      sortRising: "上升最快",
      sortUpdated: "最近更新",
      browseCategories: "按分类浏览",
      recommend: {
        inputLabel: "描述需求或插件名",
        placeholder: "描述你的需求，或输入插件名",
        button: "推荐",
        helpLink: "没找到您的 plugin？帮助我们",
        examples: ["查天气", "格式化 diff", "读网页"],
        resultsHeading: "为您推荐",
      empty: "目录由实时 registry 提供，这里没有可展示的同步记录。",
        loading: "正在推荐，接口可能较慢…",
        modal: {
          body: "粘贴 npm 包名，我们会加入验证队列；manifest 通过后会出现在目录中。",
          title: "提交 npm 包",
          label: "npm 包名",
          placeholder: "粘贴 npm 包名",
          submit: "提交同步",
          submitting: "提交中…",
          cancel: "取消",
          close: "关闭",
          queued: "已进入验证队列；manifest 通过后会自动出现在目录中。",
          invalid: "请输入有效的 npm 包名。",
          rateLimited: "提交得有点快，请稍后再试。",
          unavailable: "同步服务暂时不可用，请稍后再试。",
          failed: "提交失败，请稍后再试。",
        },
        errors: {
          required: "请输入需求或插件名。",
          tooLarge: "查询过长，请缩短后再试。",
          rateLimited: "请求有点频繁，请稍后再试。",
          llmBusy: "推荐服务正忙，请稍后再试。",
          llmUnavailable: "推荐服务暂时不可用，请稍后再试。",
          storageUnavailable: "目录服务暂时不可用，请稍后再试。",
          network: "网络异常，请检查连接后重试。",
          abort: "请求超时，请稍后再试。",
          failed: "推荐失败，请稍后再试。",
        },
      },
      categoryResult: (category: string) => `${category} 类 DSH 插件`,
      categoryIntro: "该分类下经过 manifest 校验、精确版本的插件。",
      categoryEmpty: "这个分类暂时没有收录插件。",
      browseAll: (count: number) => `浏览全部 ${count} 个 DSH 插件`,
      browseAllUnknown: "浏览全部 DSH 插件",
      browseAllDescription: "按分类浏览经过 manifest 校验的 DSH 插件，查看精确版本与一键安装命令。",
      browseAllEyebrow: "全部分类",
      browseAllIntro: "每个分类下列出已收录的插件；点击分类可查看完整列表。",
      browseAllLoading: "分类列表暂时为空，插件目录仍可浏览。",
      viewCategory: "查看该分类",
      allCategories: "全部分类",
    },
    profiles: {
      title: "可复用的 DSH Profiles",
      intro: "锁定插件版本与加载顺序，让团队一条命令复现同一套 Harness。",
      searchLabel: "搜索 Profile",
      searchPlaceholder: "搜索 Profile 名称或作者",
      public: "公开 Profiles",
      count: (count: number) => `${count} 个`,
      emptyTitle: "首批 Profiles 正在准备",
      emptyBody: "登录后可以发布你的插件组合。",
      loadOrder: "加载顺序",
      version: "Profile 版本",
      compatibility: "DSH 兼容",
      patchCount: "Patch 数量",
    },
    status: {
      title: "收录流水线状态",
      intro: "npm 同步与 GitHub 发现的公开运行状态。每 6 小时自动执行一轮。",
      introLive: "目录由实时 registry 提供，不依赖本页流水线记录。",
      pipeline: "npm 同步流水线",
      githubDiscovery: "GitHub 发现",
      sourceOnlyCount: (count: number) => `${count} 个 source-only 仓库`,
      recent: "最近同步",
      packageName: "Package",
      state: "状态",
      kind: "类型",
      syncedAt: "同步时间",
      lastError: "最近错误",
      empty: "目录由实时 registry 提供，这里没有可展示的同步记录。",
      states: {
        pending: "待处理",
        syncing: "同步中",
        accepted: "已收录",
        rejected: "已拒绝",
        error: "待重试",
      },
      kinds: { plugin: "Plugin", profile: "Profile" },
    },
  },
  en: {
    languageName: "English",
    alternateLanguageName: "中文",
    nav: {
      plugins: "Plugins",
      profiles: "Profiles",
      categories: "Categories",
      docs: "Docs",
      signIn: "Sign in",
      publish: "Publish",
    },
    common: {
      search: "Search",
      claimed: "Claimed",
      viewSource: "View source \u2197",
      homepage: "Project homepage \u2197",
      reportIssue: "Report an issue",
      unavailable: "Unavailable",
      undeclared: "Not declared",
    },
    plugins: {
      title: "Discover verified DSH plugins",
      intro: "Inspect versions, compatibility, HMR behavior, source code, and exact install commands.",
      searchLabel: "Search plugins",
      searchPlaceholder: "Search by name, capability, or keyword",
      all: "All plugins",
      result: (query: string) => `Results for \u201c${query}\u201d`,
      count: (count: number) => `${count} ${count === 1 ? "plugin" : "plugins"}`,
      emptyTitle: "No matching plugins yet",
      emptyBody: "Try another search or submit an npm package for validation.",
      emptyAction: "Open publisher console",
      description: "Description",
      versions: "Versions",
      showMoreVersions: (count: number) =>
        `Show ${count} more ${count === 1 ? "version" : "versions"}`,
      hideVersions: "Collapse versions",
      latest: "Latest",
      unpackedSize: "Unpacked size",
      fileCount: "Files",
      license: "License",
      source: "Source",
      hmr: {
        full: "Applies immediately",
        config: "Recompose configuration",
        refresh: "Refresh required",
        restart: "Process restart",
      },
      treeShaking: {
        false: "Declares sideEffects: false",
        files: "Declares side effects by file",
        unknown: "Safe tree shaking not declared",
      },
      sourceOnlyTitle: "Community plugins on GitHub",
      sourceOnlyIntro:
        "These repositories carry a DSH ecosystem topic but have not published an npm package yet. Once the author publishes one with a DSH manifest, the listing upgrades to a verified entry with an exact install command.",
      sourceOnlyBadge: "GitHub source",
      sourceOnlyCta: "View repository",
      lastPush: "Last push",
      weeklyDownloads: "Weekly downloads",
      weeklyDownloadsTitle: "Weekly npm downloads",
      securityPassed: "Scan passed",
      securityPassedTitle: "Latest version passed the static security scan",
      updatedLabel: "Updated",
      nextPage: "Next",
      prevPage: "Previous",
      firstPage: "Back to first page",
      totalCount: (count: number) => `${count} ${count === 1 ? "plugin" : "plugins"}`,
      sortLabel: "Sort",
      sortPopular: "Popular",
      sortRising: "Rising",
      sortUpdated: "Recently updated",
      browseCategories: "Browse by category",
      recommend: {
        inputLabel: "Describe a need or plugin name",
        placeholder: "Describe a need, or type a plugin name",
        button: "Recommend",
        helpLink: "Can't find your plugin? Help us",
        examples: ["check weather", "format diffs", "read a webpage"],
        resultsHeading: "Recommended for you",
      empty: "目录由实时 registry 提供，这里没有可展示的同步记录。",
        loading: "Finding matches \u2014 this may take a moment\u2026",
        modal: {
          title: "Submit an npm package",
          body: "Added to the validation queue. It will appear after its manifest passes.",
          label: "Submit an npm package name",
          placeholder: "Paste an npm package name",
          submit: "Submit for sync",
          submitting: "Submitting\u2026",
          cancel: "Cancel",
          close: "Close",
          queued: "Added to the validation queue. It will appear after its manifest passes.",
          invalid: "Enter a valid npm package name.",
          rateLimited: "Too many submissions. Please try again shortly.",
          unavailable: "The sync service is temporarily unavailable.",
          failed: "Submission failed. Please try again.",
        },
        errors: {
          required: "Enter a need or plugin name.",
          tooLarge: "That query is too long. Try a shorter one.",
          rateLimited: "Too many requests. Please try again later.",
          llmBusy: "The recommender is busy. Please try again.",
          llmUnavailable: "Recommendations are temporarily unavailable.",
          storageUnavailable: "The catalog is temporarily unavailable.",
          network: "Network error. Check your connection and try again.",
          abort: "The request timed out. Please try again.",
          failed: "Could not get recommendations. Please try again.",
        },
      },
      categoryResult: (category: string) => `${category} DSH plugins`,
      categoryIntro: "Verified manifests and exact versions in this category.",
      categoryEmpty: "No plugins in this category yet.",
      browseAll: (count: number) => `Browse all ${count} DSH plugins`,
      browseAllUnknown: "Browse all DSH plugins",
      browseAllDescription: "Browse verified DSH plugins by category, with exact versions and one-command installs.",
      browseAllEyebrow: "ALL CATEGORIES",
      browseAllIntro: "Each category lists registered plugins. Open a category for the full set.",
      browseAllLoading: "No categories yet. The plugin catalog is still available.",
      viewCategory: "View category",
      allCategories: "All categories",
    },
    profiles: {
      title: "Reusable DSH profiles",
      intro: "Pin plugin versions and load order so a team can reproduce the same Harness with one command.",
      searchLabel: "Search profiles",
      searchPlaceholder: "Search by profile name or author",
      public: "Public profiles",
      count: (count: number) => `${count} ${count === 1 ? "profile" : "profiles"}`,
      emptyTitle: "The first profiles are being prepared",
      emptyBody: "Sign in to publish your plugin stack.",
      loadOrder: "Load order",
      version: "Profile version",
      compatibility: "DSH compatibility",
      patchCount: "Patches",
    },
    status: {
      title: "Ingestion pipeline status",
      intro: "Public view of npm sync and GitHub discovery. Runs automatically every six hours.",
      introLive: "The catalog is served from the live registry.",
      pipeline: "npm sync pipeline",
      githubDiscovery: "GitHub discovery",
      sourceOnlyCount: (count: number) => `${count} source-only ${count === 1 ? "repository" : "repositories"}`,
      recent: "Recently synced",
      packageName: "Package",
      state: "Status",
      kind: "Kind",
      syncedAt: "Synced at",
      lastError: "Last error",
      empty: "The catalog is served from the live registry. No ingestion-pipeline runs are shown here.",
      states: {
        pending: "Pending",
        syncing: "Syncing",
        accepted: "Accepted",
        rejected: "Rejected",
        error: "Retrying",
      },
      kinds: { plugin: "Plugin", profile: "Profile" },
    },
  },
} as const;
