export type GuideSection = {
  heading: string;
  paragraphs: string[];
  code?: { language: string; content: string };
};

export type Guide = {
  slug: string;
  title: { zh: string; en: string };
  description: { zh: string; en: string };
  sections: { zh: GuideSection[]; en: GuideSection[] };
};

export const guides: Guide[] = [
  {
    slug: "install-failed",
    title: { zh: "插件安装失败排查", en: "Troubleshooting Plugin Install Failures" },
    description: {
      zh: "插件安装时报错？按这个清单逐步排查包名、manifest、版本格式和网络问题。",
      en: "Getting errors when installing a plugin? Follow this checklist to diagnose package name, manifest, version format, and network issues.",
    },
    sections: {
      zh: [
        {
          heading: "确认包名正确",
          paragraphs: [
            "DSH Plugin Hub 从 npm Registry 同步插件。安装时使用的包名必须和 npm 上发布的名称完全一致，包括 scope（如 @author/plugin-name）。",
            "常见的包名错误包括：多打了空格、忘记 scope 前缀、大小写不匹配。npm 包名是全小写的。",
          ],
          code: {
            language: "bash",
            content: "# 检查包是否存在于 npm\nnpm view @author/plugin-name",
          },
        },
        {
          heading: "确认包含 DSH manifest",
          paragraphs: [
            "每个 DSH 插件的 package.json 必须包含 dsh.bundle 字段，指向 Cordis patch 文件。缺少这个字段的包会被 Hub 拒绝。",
          ],
          code: {
            language: "json",
            content: '{\n  "name": "my-plugin",\n  "version": "1.0.0",\n  "dsh": {\n    "bundle": {\n      "patch": "./cordis.patch.yml"\n    }\n  }\n}',
          },
        },
        {
          heading: "版本必须是精确 SemVer",
          paragraphs: [
            "package.json 的 version 字段必须是精确的语义化版本号（如 1.2.3），不能带范围前缀（^、~）或标签。",
            "使用 dsh-hub validate 在发布前检查所有格式问题：",
          ],
          code: {
            language: "bash",
            content: "dsh-hub validate my-plugin",
          },
        },
        {
          heading: "检查 Cordis patch 文件",
          paragraphs: [
            "patch 文件路径是相对于 package.json 的。确保文件存在、YAML 语法正确、且包含至少一个有效的 entry。",
            "dsh-hub validate 会检查 patch 文件中的 entry ID 是否与 hub 元数据中声明的 entryIds 匹配。",
          ],
        },
        {
          heading: "网络问题",
          paragraphs: [
            "如果 npm Registry 暂时不可达，Hub 会自动重试。被拒绝的包会在一天后重新检查。你也可以在插件页面手动提交包名加速同步。",
          ],
        },
      ],
      en: [
        {
          heading: "Verify the package name",
          paragraphs: [
            "DSH Plugin Hub syncs plugins from the npm Registry. The package name used during installation must exactly match the published npm name, including the scope (e.g. @author/plugin-name).",
            "Common mistakes include: extra spaces, missing scope prefix, case mismatches. npm package names are all lowercase.",
          ],
          code: {
            language: "bash",
            content: "# Check if the package exists on npm\nnpm view @author/plugin-name",
          },
        },
        {
          heading: "Ensure the DSH manifest exists",
          paragraphs: [
            "Every DSH plugin's package.json must include the dsh.bundle field pointing to a Cordis patch file. Packages missing this field are rejected by the Hub.",
          ],
          code: {
            language: "json",
            content: '{\n  "name": "my-plugin",\n  "version": "1.0.0",\n  "dsh": {\n    "bundle": {\n      "patch": "./cordis.patch.yml"\n    }\n  }\n}',
          },
        },
        {
          heading: "Version must be exact SemVer",
          paragraphs: [
            "The version field in package.json must be an exact semantic version (e.g. 1.2.3) — no range prefixes (^, ~) or tags.",
            "Use dsh-hub validate to check all format issues before publishing:",
          ],
          code: {
            language: "bash",
            content: "dsh-hub validate my-plugin",
          },
        },
        {
          heading: "Check the Cordis patch file",
          paragraphs: [
            "The patch file path is relative to package.json. Make sure the file exists, the YAML syntax is valid, and it contains at least one valid entry.",
            "dsh-hub validate checks that entry IDs in the patch file match the entryIds declared in hub metadata.",
          ],
        },
        {
          heading: "Network issues",
          paragraphs: [
            "If the npm Registry is temporarily unreachable, the Hub retries automatically. Rejected packages are rechecked after one day. You can also manually submit a package name on the plugins page to speed up syncing.",
          ],
        },
      ],
    },
  },
  {
    slug: "version-incompatible",
    title: { zh: "DSH 版本不兼容", en: "DSH Version Incompatibility" },
    description: {
      zh: "插件声明的 DSH 版本范围和当前环境不匹配时的排查和修复方法。",
      en: "How to diagnose and fix version range mismatches between a plugin's declared compatibility and your DSH environment.",
    },
    sections: {
      zh: [
        {
          heading: "兼容性声明在哪里",
          paragraphs: [
            "插件通过 package.json 中的 dsh.hub.compatibility.dsh 字段声明兼容的 DSH 版本范围。这是一个标准的 semver range 表达式。",
          ],
          code: {
            language: "json",
            content: '{\n  "dsh": {\n    "hub": {\n      "compatibility": {\n        "dsh": ">=0.1.0-rc.7",\n        "node": ">=22",\n        "platforms": ["darwin", "linux"],\n        "surfaces": ["web"]\n      }\n    }\n  }\n}',
          },
        },
        {
          heading: "常见的不兼容原因",
          paragraphs: [
            "DSH 版本低于插件要求：升级 DSH 到兼容版本。",
            "Node.js 版本不满足：检查 compatibility.node 字段，确保运行环境满足要求。",
            "平台不匹配：某些插件可能只在特定平台（如 macOS、Linux）上可用。",
            "Surface 不匹配：插件可能只支持 web 或特定界面。",
          ],
        },
        {
          heading: "如何更新兼容性声明",
          paragraphs: [
            "如果你是插件作者，修改 package.json 中的 compatibility 字段后发布新版本即可。Hub 会在下一次同步时更新展示。",
            "已认领插件的作者可以直接在 Dashboard 中编辑兼容性说明，无需发新版。",
          ],
        },
      ],
      en: [
        {
          heading: "Where compatibility is declared",
          paragraphs: [
            "Plugins declare their compatible DSH version range via the dsh.hub.compatibility.dsh field in package.json. This is a standard semver range expression.",
          ],
          code: {
            language: "json",
            content: '{\n  "dsh": {\n    "hub": {\n      "compatibility": {\n        "dsh": ">=0.1.0-rc.7",\n        "node": ">=22",\n        "platforms": ["darwin", "linux"],\n        "surfaces": ["web"]\n      }\n    }\n  }\n}',
          },
        },
        {
          heading: "Common incompatibility causes",
          paragraphs: [
            "DSH version below requirement: upgrade DSH to a compatible version.",
            "Node.js version mismatch: check the compatibility.node field and ensure your runtime meets the requirement.",
            "Platform mismatch: some plugins may only be available on specific platforms (e.g. macOS, Linux).",
            "Surface mismatch: a plugin may only support web or specific interfaces.",
          ],
        },
        {
          heading: "How to update compatibility declarations",
          paragraphs: [
            "If you're the plugin author, update the compatibility field in package.json and publish a new version. The Hub will update its display on the next sync.",
            "Authors with claimed plugins can edit compatibility notes directly in the Dashboard without publishing a new version.",
          ],
        },
      ],
    },
  },
  {
    slug: "hmr-not-working",
    title: { zh: "插件 HMR 不工作", en: "Plugin HMR Not Working" },
    description: {
      zh: "理解 DSH 的四种 HMR 模式，选择正确的模式并排查热更新失效的原因。",
      en: "Understand DSH's four HMR modes, choose the right one, and troubleshoot hot-reload failures.",
    },
    sections: {
      zh: [
        {
          heading: "四种 HMR 模式",
          paragraphs: [
            "DSH 插件支持四种热更新模式，在 dsh.hub.compatibility.hmr 字段中声明：",
            "full — 插件可以在不重启宿主进程的情况下应用和销毁。这是最高级别的 HMR，需要插件正确实现 apply 和 dispose 生命周期钩子。",
            "config — 配置变更可以通过重新组合配置层来生效，无需完全卸载插件。",
            "refresh — 需要刷新 web/客户端界面才能看到变更。",
            "restart — 必须重启 DSH 进程才能加载变更。这是最低级别的兼容模式。",
          ],
        },
        {
          heading: "选择正确的模式",
          paragraphs: [
            "如果你的插件只修改配置，config 模式就够了。如果插件有 UI 组件，通常需要 refresh。只有当插件完全实现了运行时钩子时才能用 full。",
            "声明比实际支持更高级的 HMR 模式会导致更新不生效或状态不一致。",
          ],
          code: {
            language: "json",
            content: '{\n  "dsh": {\n    "hub": {\n      "compatibility": {\n        "hmr": "refresh"\n      }\n    }\n  }\n}',
          },
        },
        {
          heading: "排查 HMR 失效",
          paragraphs: [
            "检查插件声明的 HMR 模式是否和实际行为匹配。如果声明了 full 但没有正确实现 dispose，旧实例可能不会清理。",
            "确认 Cordis patch 中的 entry ID 没有冲突。多个插件注册相同 ID 时，后加载的会覆盖先加载的。",
            "查看 DSH 日志中的 HMR 相关事件，确认变更是否被检测到。",
          ],
        },
      ],
      en: [
        {
          heading: "Four HMR modes",
          paragraphs: [
            "DSH plugins support four hot-reload modes, declared in the dsh.hub.compatibility.hmr field:",
            "full — the plugin can be applied and disposed without restarting the host process. This is the highest level of HMR and requires the plugin to correctly implement apply and dispose lifecycle hooks.",
            "config — configuration changes take effect by recomposing config layers without fully unloading the plugin.",
            "refresh — a web/client refresh is required to see changes.",
            "restart — a DSH process restart is required to load changes. This is the lowest compatibility mode.",
          ],
        },
        {
          heading: "Choosing the right mode",
          paragraphs: [
            "If your plugin only modifies configuration, config mode is sufficient. If it has UI components, refresh is usually needed. Only use full when the plugin fully implements runtime hooks.",
            "Declaring a higher HMR mode than actually supported leads to stale updates or inconsistent state.",
          ],
          code: {
            language: "json",
            content: '{\n  "dsh": {\n    "hub": {\n      "compatibility": {\n        "hmr": "refresh"\n      }\n    }\n  }\n}',
          },
        },
        {
          heading: "Troubleshooting HMR failures",
          paragraphs: [
            "Check whether the declared HMR mode matches actual behavior. If full is declared but dispose isn't properly implemented, old instances may not be cleaned up.",
            "Verify there are no entry ID conflicts in the Cordis patch. When multiple plugins register the same ID, the later one overrides the earlier.",
            "Check DSH logs for HMR-related events to confirm changes are being detected.",
          ],
        },
      ],
    },
  },
  {
    slug: "plugin-not-found",
    title: { zh: "发布后搜不到插件", en: "Plugin Not Showing Up After Publishing" },
    description: {
      zh: "插件发布到 npm 后在 Hub 上找不到？了解同步周期、手动加速和常见拒绝原因。",
      en: "Published to npm but can't find your plugin on the Hub? Learn about sync cycles, manual acceleration, and common rejection reasons.",
    },
    sections: {
      zh: [
        {
          heading: "同步不是实时的",
          paragraphs: [
            "Hub 每 6 小时运行一次自动发现。如果你的插件刚发布到 npm，需要等到下一轮发现才能出现在目录中。",
          ],
        },
        {
          heading: "手动加速同步",
          paragraphs: [
            "在插件页面直接输入包名提交，Hub 会优先处理这个包。已登录的发布者还可以在 Dashboard 中使用「立即同步」功能，实时等待结果。",
          ],
        },
        {
          heading: "常见拒绝原因",
          paragraphs: [
            "缺少 dsh.bundle 或 dsh.profile 字段 — Hub 只收录包含有效 DSH manifest 的包。",
            "版本号不是精确 SemVer — 检查是否有 ^ 或 ~ 前缀。",
            "Cordis patch 文件缺失或格式错误 — 确保 patch 路径正确且 YAML 语法有效。",
            "包体积超限 — Hub 对包大小有限制。",
            "npm 包不存在或已删除 — 确认包仍然可以在 npm 上访问。",
          ],
        },
        {
          heading: "GitHub source-only 收录",
          paragraphs: [
            "即使还没有发布 npm 包，只要 GitHub 仓库带有 dsh-plugin 或 deepseek-harness topic，就会作为 source-only 条目出现在目录中。用户可以看到仓库信息但不能直接安装。",
            "发布后 npm 包，下次同步时 source-only 条目会自动升级为完整的插件记录。",
          ],
        },
      ],
      en: [
        {
          heading: "Syncing is not real-time",
          paragraphs: [
            "The Hub runs automatic discovery every 6 hours. If your plugin was just published to npm, it needs to wait for the next discovery cycle to appear in the catalog.",
          ],
        },
        {
          heading: "Manually accelerate syncing",
          paragraphs: [
            "Submit the package name directly on the plugins page and the Hub will prioritize it. Signed-in publishers can also use the \"Sync Now\" action in the Dashboard for real-time results.",
          ],
        },
        {
          heading: "Common rejection reasons",
          paragraphs: [
            "Missing dsh.bundle or dsh.profile field — the Hub only accepts packages with a valid DSH manifest.",
            "Version is not exact SemVer — check for ^ or ~ prefixes.",
            "Cordis patch file missing or malformed — ensure the patch path is correct and the YAML syntax is valid.",
            "Package size exceeds the limit — the Hub enforces a size cap.",
            "npm package doesn't exist or was removed — confirm the package is still accessible on npm.",
          ],
        },
        {
          heading: "GitHub source-only listings",
          paragraphs: [
            "Even without an npm package, a GitHub repository tagged with the dsh-plugin or deepseek-harness topic appears in the catalog as a source-only listing. Users can see the repository info but can't install it directly.",
            "Once you publish the npm package, the source-only entry is automatically upgraded to a full plugin record on the next sync.",
          ],
        },
      ],
    },
  },
  {
    slug: "first-plugin",
    title: { zh: "写你的第一个 DSH 插件", en: "Write Your First DSH Plugin" },
    description: {
      zh: "从脚手架到发布上架的完整流程：init、validate、publish、claim。",
      en: "The complete workflow from scaffolding to publishing: init, validate, publish, claim.",
    },
    sections: {
      zh: [
        {
          heading: "初始化项目",
          paragraphs: [
            "使用 CLI 生成一个完整的插件骨架：",
          ],
          code: {
            language: "bash",
            content: "dsh-hub init my-plugin --repository your-name/my-plugin\n\n# 使用 scoped 包名\ndsh-hub init my-plugin --name @your-scope/my-plugin --repository your-name/my-plugin",
          },
        },
        {
          heading: "项目结构",
          paragraphs: [
            "生成的项目包含三个核心文件：",
            "package.json — 包含 npm 元数据和 DSH manifest（dsh.bundle、hub 列表信息、兼容性声明）。",
            "cordis.patch.yml — 定义插件的 Cordis entry，描述插件在系统中的注册行为。",
            "src/ — 插件源代码目录。",
          ],
        },
        {
          heading: "本地验证",
          paragraphs: [
            "发布前用 validate 命令检查所有格式要求：",
          ],
          code: {
            language: "bash",
            content: "dsh-hub validate my-plugin",
          },
        },
        {
          heading: "发布到 npm",
          paragraphs: [
            "验证通过后，像普通 npm 包一样发布：",
          ],
          code: {
            language: "bash",
            content: "cd my-plugin\nnpm publish",
          },
        },
        {
          heading: "在 Hub 上展示",
          paragraphs: [
            "发布后，插件会在下一轮 6 小时同步中自动出现。你也可以在插件页面手动提交包名加速。",
            "要管理列表信息（截图、分类、描述），需要认领插件：登录 Hub，安装 GitHub App 到你的仓库，系统验证后你就可以直接在 Dashboard 编辑。",
          ],
        },
      ],
      en: [
        {
          heading: "Initialize the project",
          paragraphs: [
            "Use the CLI to generate a complete plugin scaffold:",
          ],
          code: {
            language: "bash",
            content: "dsh-hub init my-plugin --repository your-name/my-plugin\n\n# With a scoped package name\ndsh-hub init my-plugin --name @your-scope/my-plugin --repository your-name/my-plugin",
          },
        },
        {
          heading: "Project structure",
          paragraphs: [
            "The generated project contains three core files:",
            "package.json — contains npm metadata and the DSH manifest (dsh.bundle, hub listing info, compatibility declarations).",
            "cordis.patch.yml — defines the plugin's Cordis entries, describing how the plugin registers itself in the system.",
            "src/ — the plugin source code directory.",
          ],
        },
        {
          heading: "Validate locally",
          paragraphs: [
            "Before publishing, check all format requirements with the validate command:",
          ],
          code: {
            language: "bash",
            content: "dsh-hub validate my-plugin",
          },
        },
        {
          heading: "Publish to npm",
          paragraphs: [
            "After validation passes, publish like a normal npm package:",
          ],
          code: {
            language: "bash",
            content: "cd my-plugin\nnpm publish",
          },
        },
        {
          heading: "Appearing on the Hub",
          paragraphs: [
            "After publishing, the plugin will appear automatically in the next 6-hour sync cycle. You can also manually submit the package name on the plugins page for faster discovery.",
            "To manage listing info (screenshots, categories, description), claim your plugin: sign in to the Hub, install the GitHub App on your repository, and after verification you can edit directly in the Dashboard.",
          ],
        },
      ],
    },
  },
];

export function findGuide(slug: string): Guide | undefined {
  return guides.find((g) => g.slug === slug);
}
