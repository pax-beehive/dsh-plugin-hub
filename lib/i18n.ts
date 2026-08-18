export type HubLocale = "zh" | "en";

export const HUB_LOCALE_COOKIE = "dsh-hub-locale";

export const localeTags: Record<HubLocale, "zh-CN" | "en"> = {
  zh: "zh-CN",
  en: "en",
};

export function parseHubLocale(value: unknown): HubLocale {
  return value === "en" ? "en" : "zh";
}

export const hubCopy = {
  zh: {
    languageName: "中文",
    alternateLanguageName: "EN",
    nav: { plugins: "Plugins", profiles: "Profiles", publish: "发布" },
    common: {
      search: "搜索",
      claimed: "已认领",
      viewSource: "查看源码 ↗",
      homepage: "项目主页 ↗",
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
  },
  en: {
    languageName: "English",
    alternateLanguageName: "中文",
    nav: { plugins: "Plugins", profiles: "Profiles", publish: "Publish" },
    common: {
      search: "Search",
      claimed: "Claimed",
      viewSource: "View source ↗",
      homepage: "Project homepage ↗",
      unavailable: "Unavailable",
      undeclared: "Not declared",
    },
    plugins: {
      title: "Discover verified DSH plugins",
      intro: "Inspect versions, compatibility, HMR behavior, source code, and exact install commands.",
      searchLabel: "Search plugins",
      searchPlaceholder: "Search by name, capability, or keyword",
      all: "All plugins",
      result: (query: string) => `Results for “${query}”`,
      count: (count: number) => `${count} ${count === 1 ? "plugin" : "plugins"}`,
      emptyTitle: "No matching plugins yet",
      emptyBody: "Try another search or submit an npm package for validation.",
      emptyAction: "Open publisher console",
      description: "Description",
      versions: "Versions",
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
  },
} as const;
