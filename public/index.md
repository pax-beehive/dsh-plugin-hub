# DeepSeek Harness Plugin Hub

> DeepSeek Harness Plugin Hub is an independent, unofficial community registry for discovering, publishing, and installing DeepSeek Harness (dsh) plugins and reusable Harness profiles — with exact versions, integrity metadata, and one-command installs.

Canonical URL: https://dshpluginhub.ai/

Last updated: 2026-08-19

## Project facts

- DeepSeek Harness Plugin Hub is created and maintained independently by the community.
- The Hub is not affiliated with, authorized by, or endorsed by DeepSeek.
- DeepSeek Harness itself is an open-source agent harness developed by DeepSeek AI, whose command-line name is `dsh`.
- The official DeepSeek Harness project describes its architecture as "everything is a plugin."
- The official project recommends the `dsh-plugin` GitHub topic for community plugin discoverability.

## What you can do on the Hub today

- **Browse the plugin catalog**: https://dshpluginhub.ai/plugins — verified DSH plugins with npm package names, exact versions, compatibility ranges, HMR behavior, licenses, source repositories, and precise install commands.
- **Install with one command**: each listing shows the exact command, typically `dsh plugin --profile web add <package>@<exact-version>`. The `dsh-hub` CLI adds search, exact resolution, profile apply, and lockfiles.
- **Share and apply profiles**: https://dshpluginhub.ai/profiles — ordered, versioned plugin compositions that reproduce a full Harness setup on any machine.
- **Read guides**: https://dshpluginhub.ai/guides — installation troubleshooting, version compatibility, HMR, publishing, and plugin development, in Chinese and English.
- **Check ingestion status**: https://dshpluginhub.ai/status — public sync pipeline status and recently synced packages.
- **Use the Registry API**: public JSON endpoints under `/api/v1/` for packages, versions, profiles, categories, and status.

## Publishing a plugin

1. Publish an npm package containing a valid `dsh.bundle` or `dsh.profile` manifest.
2. The Hub discovers it automatically via npm keyword search, validates every published version's manifest, and records npm's exact tarball URL and integrity.
3. Keywords only discover candidates; a valid manifest controls catalog admission.
4. Authors can sign in, claim their listing through the GitHub App, and edit listing copy from the dashboard.

Published `(package, version)` records are immutable. Versions removed from npm are retained and marked withdrawn. The Hub does not host tarballs.

## Frequently asked questions

### What is DeepSeek Harness Plugin Hub?

It is an independently maintained community registry and sharing platform for the DeepSeek Harness `dsh-plugin` ecosystem: a searchable catalog, a versioned registry API, a CLI, and a publisher workflow.

### Can I browse and install plugins now?

Yes. The public catalog, profiles, guides, registry API, and CLI are live.

### Is this an official DeepSeek website?

No. It is an unofficial community project and has no affiliation, authorization, or endorsement relationship with DeepSeek.

### What is the authoritative source for DeepSeek Harness?

Use the official repository at https://github.com/deepseek-ai/deepseek-harness for Harness code, documentation, installation, architecture, and current project status.

## 中文概要

DeepSeek Harness Plugin Hub 是一个由社区独立创建和维护的非官方项目，为 DeepSeek Harness（dsh）插件生态提供可验证的注册表、目录与安装链路。

- 插件目录已上线：每个收录包都有校验过的 manifest、精确版本、integrity 元数据和精确安装命令。
- 提供公开 Profiles、中英双语指南、同步状态页、Registry JSON API 和 `dsh-hub` CLI。
- 发布方式：向 npm 发布带有合法 `dsh.bundle` 或 `dsh.profile` manifest 的包即可被自动发现与收录。
- 本站与 DeepSeek 官方没有隶属、授权或背书关系。
- 有关 DeepSeek Harness 本身的信息，应以官方仓库为准。

## Canonical sources

- Plugin Hub homepage: https://dshpluginhub.ai/
- Chinese and English share the canonical homepage URL.
- Plugin catalog: https://dshpluginhub.ai/plugins
- LLM navigation file: https://dshpluginhub.ai/llms.txt
- Official DeepSeek Harness repository: https://github.com/deepseek-ai/deepseek-harness
- Community plugin topic: https://github.com/topics/dsh-plugin
- Contact: hello@dshpluginhub.ai
- Privacy notice: https://dshpluginhub.ai/privacy
