import SiteDocument from "@/components/SiteDocument";
import { getHubLocale } from "@/lib/i18n-server";
import type { Metadata } from "next";
import "../globals.css";

const siteUrl = new URL("https://dshpluginhub.ai");
const localizedMetadata = {
  zh: {
    title: "DeepSeek Harness Plugin Hub — 插件发现与分享社区",
    description: "DeepSeek Harness Plugin Hub 是一个非官方独立社区项目，旨在帮助开发者发现、分享与安装 Harness 插件，并交流可复用的 Harness 配置。",
    locale: "zh_CN",
    alternateLocale: ["en_US"],
  },
  en: {
    title: "DeepSeek Harness Plugin Hub — Discover and share plugins",
    description: "An independent, unofficial community hub for discovering, sharing, and installing DeepSeek Harness plugins and reusable Harness configurations.",
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
    "dsh plugin",
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
