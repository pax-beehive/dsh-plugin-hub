import SiteDocument from "@/components/SiteDocument";
import { getHubLocale } from "@/lib/i18n-server";
import type { Metadata } from "next";
import "../globals.css";

const siteUrl = new URL("https://dshpluginhub.ai");
const localizedMetadata = {
  zh: {
    title: "DSH Plugin Hub — DeepSeek Harness 插件目录、Profiles 与安装社区",
    description: "DeepSeek Harness（dsh）插件的社区注册表：发现经过 manifest 校验的 DSH 插件与可复用 Profiles，查看精确版本、兼容范围与一键安装命令，并用 dsh-hub CLI 复现整套 Harness 配置。非官方独立社区项目。",
    locale: "zh_CN",
    alternateLocale: ["en_US"],
  },
  en: {
    title: "DSH Plugin Hub — DeepSeek Harness Plugins, Profiles & Guides",
    description: "The community registry for DeepSeek Harness (dsh) plugins: discover manifest-verified DSH plugins and reusable profiles, check exact versions, compatibility and integrity, and install with one command via the dsh-hub CLI. Independent and unofficial.",
    locale: "en_US",
    alternateLocale: ["zh_CN"],
  },
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getHubLocale();
  const copy = localizedMetadata[locale];
  return {
  metadataBase: siteUrl,
  title: copy.title,
  description: copy.description,
  applicationName: "DeepSeek Harness Plugin Hub",
  creator: "DeepSeek Harness Plugin Hub Community",
  publisher: "DeepSeek Harness Plugin Hub Community",
  category: "technology",
  keywords: [
    "DeepSeek Harness",
    "DeepSeek Harness plugins",
    "dsh",
    "dsh plugin",
    "dsh profile",
    "dsh bundle",
    "deepseek harness 插件",
    "dsh 插件",
    "agent harness",
    "AI agent plugins",
    "Harness 插件",
    "插件市场",
    "插件社区",
  ],
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "64x64" },
      { url: "/favicon-64.png", type: "image/png", sizes: "64x64" },
      { url: "/deepseek-whale-black.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.ico",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "DeepSeek Harness Plugin Hub",
    locale: copy.locale,
    alternateLocale: [...copy.alternateLocale],
    title: copy.title,
    description: copy.description,
    images: [
      {
        url: "/og-v2.png",
        width: 1536,
        height: 1024,
        alt: "DeepSeek Harness Plugin Hub — independent community project",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: copy.title,
    description: copy.description,
    images: ["/og-v2.png"],
  },
};
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getHubLocale();
  return <SiteDocument language={locale === "en" ? "en" : "zh-CN"}>{children}</SiteDocument>;
}
