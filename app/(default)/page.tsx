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
          title: "DSH Plugin Hub — DeepSeek Harness Plugins, Profiles & Docs",
          description:
            "The community registry for DeepSeek Harness (dsh) plugins: discover manifest-verified DSH plugins and reusable profiles, check exact versions, compatibility and integrity, and install with one command via the dsh-hub CLI. Independent and unofficial.",
        }
      : {
          title: "DSH Plugin Hub — DeepSeek Harness 插件目录、Profiles 与安装社区",
          description:
            "DeepSeek Harness（dsh）插件的社区注册表：发现经过 manifest 校验的 DSH 插件与可复用 Profiles，查看精确版本、兼容范围与一键安装命令，并用 dsh-hub CLI 复现整套 Harness 配置。非官方独立社区项目。",
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
