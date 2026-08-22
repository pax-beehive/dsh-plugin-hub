import HomePage from "@/components/HomePage";
import { getHubLocale } from "@/lib/i18n-server";
import { homePageMetadata } from "@/lib/page-metadata";
import { SITE_HOME } from "@/lib/site-url";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getHubLocale();
  return homePageMetadata(
    locale === "en"
      ? {
          title: "DSH plugin registry — exact versions, manifests, one-command installs",
          description:
            "The community registry for DeepSeek Harness (dsh) plugins: discover manifest-verified DSH plugins, check exact versions, compatibility and integrity, and install with one command via the dsh-hub CLI. Independent and unofficial.",
        }
      : {
          title: "DSH 插件注册表 — 精确版本、manifest 与一键安装",
          description:
            "DeepSeek Harness（dsh）插件的社区注册表：发现经过 manifest 校验的 DSH 插件，查看精确版本、兼容范围与一键安装命令。非官方独立社区项目。",
        },
  );
}

export default async function Home() {
  return (
    <>
      {/* Vinext's metadata URL formatter strips the homepage trailing slash.
          Emit the tags as raw document metadata so the slash cannot disappear. */}
      <link rel="canonical" href={SITE_HOME} />
      <meta property="og:url" content={SITE_HOME} />
      <HomePage initialLanguage={await getHubLocale()} />
    </>
  );
}
