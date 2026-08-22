import DashboardSignupPixel from "@/components/DashboardSignupPixel";
import { DashboardHeader } from "@/components/HubHeader";
import CopyCommand from "@/components/CopyCommand";
import PublishRepositoryButton from "@/components/PublishRepositoryButton";
import PublishNpmPackageForm from "@/components/PublishNpmPackageForm";
import { listGitHubRepositories, listOwnedPlugins } from "@/lib/hub-api";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { getHubLocale } from "@/lib/i18n-server";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ github?: string }>;
}) {
  await withAuth({ ensureSignedIn: true });
  const locale = await getHubLocale();
  const t = locale === "en" ? {
    profileTitle: "Share or build a reproducible DSH Profile",
    profileIntro: "Bring your current local setup to the Hub in one CLI command, or compose an ordered Profile directly on the web. Both paths publish the same immutable Release format.",
    shareTitle: "Share your current Profile",
    shareBody: "Capture the exact local bundle order, installed versions, patch and required input keys from the official DSH Profile.",
    loginNote: "One-time setup: run npx -y @dsh-plugin-hub/cli@latest login first.",
    webTitle: "Build on the web",
    webBody: "Choose indexed Plugins, confirm their order and selectors, then save a Draft or publish a versioned Release.",
    buildWeb: "Open Web Builder →",
    browseProfiles: "Browse public Profiles",
    npmTitle: "Sync an npm Plugin",
    npmIntro: "Enter an npm package name to sync every valid DSH version now. The Hub will check for future versions automatically.",
    admission: "Admission rules",
    bundle: "package.json contains dsh.bundle or dsh.profile",
    repository: "Plugins declare a GitHub repository",
    immutable: "An admitted package + version remains immutable",
    claimedPlugins: "Claimed plugins",
    edit: "Edit listing",
    githubTitle: "GitHub claim and automation",
    optional: "Optional",
    githubIntro: "Connect GitHub to prove access to the repository declared in package.json and claim an automatically indexed listing. npm sync does not require the GitHub App.",
    connected: "GitHub connected and repository access verified.",
    incomplete: "GitHub connection incomplete",
    manage: "Manage claim repositories",
    connect: "Connect GitHub (optional)",
    authorized: "Authorized repositories",
    private: "Private repositories are not published to the public Registry yet",
    empty: "No repositories are connected for claims yet.",
  } : {
    profileTitle: "分享或构建可复现的 DSH Profile",
    profileIntro: "用一条 CLI 命令把当前本地配置带到 Hub，或者直接在网页中组装有序 Profile。两条路径都会发布相同的不可变 Release。",
    shareTitle: "分享当前 Profile",
    shareBody: "从官方 DSH Profile 捕获准确的 Bundle 顺序、已安装版本、Patch 与本地输入键。",
    loginNote: "首次使用请先运行：npx -y @dsh-plugin-hub/cli@latest login",
    webTitle: "在 Web 上构建",
    webBody: "选择 Hub 已收录的 Plugins，确认顺序与选择器，然后保存 Draft 或发布版本化 Release。",
    buildWeb: "打开 Web Builder →",
    browseProfiles: "浏览公开 Profiles",
    npmTitle: "同步 npm Plugin",
    npmIntro: "输入 npm 包名即可立即同步全部有效 DSH 版本。之后 Hub 会自动检查新版本。",
    admission: "准入规则",
    bundle: "package.json 包含 dsh.bundle 或 dsh.profile",
    repository: "Plugin 填写 GitHub repository",
    immutable: "package + version 收录后保持不可变",
    claimedPlugins: "已认领 Plugins",
    edit: "完善页面",
    githubTitle: "GitHub 认领与自动化",
    optional: "可选",
    githubIntro: "连接后可证明你拥有 package.json 声明的仓库，并认领自动收录的页面。npm 自动同步无需安装 GitHub App。",
    connected: "GitHub 已连接，仓库权限已验证。",
    incomplete: "GitHub 连接未完成",
    manage: "管理认领仓库",
    connect: "连接 GitHub（可选）",
    authorized: "已授权仓库",
    private: "公开 Registry 暂不发布私有仓库",
    empty: "尚未连接可用于认领的仓库。",
  };
  const status = (await searchParams).github;
  const repositories = await listGitHubRepositories();
  const ownedPlugins = await listOwnedPlugins();
  return (
    <main className="dashboard-shell">
      <DashboardSignupPixel />
      <DashboardHeader locale={locale} />
      <div className="dashboard-content">
        <section className="dashboard-card dashboard-card-wide">
          <p className="dashboard-eyebrow">PROFILE CREATION</p>
          <h1>{t.profileTitle}</h1>
          <p>{t.profileIntro}</p>
          <div className="profile-path-grid">
            <article className="profile-path-card">
              <span className="profile-path-kicker">CLI · CURRENT PROFILE</span>
              <h2>{t.shareTitle}</h2>
              <p>{t.shareBody}</p>
              <CopyCommand
                command={'npx -y @dsh-plugin-hub/cli@latest profile share my-profile --version 1.0.0 --profile web --display-name "My Profile"'}
                locale={locale}
                profile="web"
                purpose="profile-share"
              />
              <small>{t.loginNote}</small>
            </article>
            <article className="profile-path-card">
              <span className="profile-path-kicker">WEB · NEW PROFILE</span>
              <h2>{t.webTitle}</h2>
              <p>{t.webBody}</p>
              <Link className="dashboard-primary" href="/dashboard/profiles/new">{t.buildWeb}</Link>
              <Link className="profile-path-secondary" href="/profiles">{t.browseProfiles}</Link>
            </article>
          </div>
        </section>
        <section className="dashboard-card dashboard-card-wide dashboard-stack-card">
          <p className="dashboard-eyebrow">NPM SYNC</p>
          <h2 className="dashboard-section-title">{t.npmTitle}</h2>
          <p>{t.npmIntro}</p>
          <PublishNpmPackageForm locale={locale} />
          <div className="publisher-requirements">
            <strong>{t.admission}</strong>
            <span>{t.bundle}</span>
            <span>{t.repository}</span>
            <span>{t.immutable}</span>
          </div>
          {ownedPlugins.length ? (
            <div className="owned-plugin-list">
              <div className="repository-list-heading">
                <h2>{t.claimedPlugins}</h2>
                <span>{ownedPlugins.length}</span>
              </div>
              {ownedPlugins.map((plugin) => (
                <div className="repository-row" key={plugin.slug}>
                  <div>
                    <strong>{plugin.displayName}</strong>
                    <span>{plugin.packageName} · {plugin.latestVersion}</span>
                  </div>
                  <Link className="listing-edit-link" href={`/dashboard/plugins/${plugin.slug}`}>{t.edit}</Link>
                </div>
              ))}
            </div>
          ) : null}
        </section>
        <section className="dashboard-card dashboard-card-wide dashboard-stack-card github-optional-card">
          <div className="optional-heading">
            <div>
              <p className="dashboard-eyebrow">OPTIONAL AUTOMATION</p>
              <h2>{t.githubTitle}</h2>
            </div>
            <span>{t.optional}</span>
          </div>
          <p>{t.githubIntro}</p>
          {status === "connected" ? (
            <p className="dashboard-success">{t.connected}</p>
          ) : null}
          {status && status !== "connected" ? (
            <p className="dashboard-error">{t.incomplete}: {status}</p>
          ) : null}
          <a className="dashboard-primary" href="/integrations/github/install">
            {repositories.length ? t.manage : t.connect}
          </a>
          <div className="repository-list">
            <div className="repository-list-heading">
              <h2>{t.authorized}</h2>
              <span>{repositories.length}</span>
            </div>
            {repositories.length ? repositories.map((repository) => (
              <div className="repository-row" key={repository.repositoryId}>
                <div>
                  <strong>{repository.fullName}</strong>
                  <span>{repository.isPrivate ? "Private" : repository.defaultBranch}</span>
                </div>
                {repository.isPrivate ? (
                  <span className="repository-private-note">{t.private}</span>
                ) : (
                  <PublishRepositoryButton repository={repository.fullName} locale={locale} />
                )}
              </div>
            )) : (
              <p className="repository-empty">{t.empty}</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
