import DashboardSignupPixel from "@/components/DashboardSignupPixel";
import { DashboardHeader } from "@/components/HubHeader";
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
  const { user } = await withAuth({ ensureSignedIn: true });
  const locale = await getHubLocale();
  const t = locale === "en" ? {
    hello: "Hello",
    intro: "Enter an npm package name to sync every valid DSH version now. The Hub will check for future versions automatically.",
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
    hello: "你好",
    intro: "输入 npm 包名即可立即同步全部有效 DSH 版本。之后 Hub 会自动检查新版本。",
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
          <p className="dashboard-eyebrow">NPM SYNC</p>
          <h1>{t.hello}, {user.name ?? user.email}</h1>
          <p>{t.intro}</p>
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
        <section className="dashboard-card dashboard-card-wide github-optional-card">
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
