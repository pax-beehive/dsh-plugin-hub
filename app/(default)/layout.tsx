import SiteDocument from "@/components/SiteDocument";
import type { Metadata } from "next";
import "../globals.css";

const siteUrl = new URL("https://dshpluginhub.ai");
const title = "DeepSeek Harness Plugin Hub — 插件发现与分享社区";
const description =
  "DeepSeek Harness Plugin Hub 是一个非官方独立社区项目，旨在帮助开发者发现、分享与安装 Harness 插件，并交流可复用的 Harness 配置。";

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title,
  description,
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
    languages: {
      "zh-CN": "/",
      en: "/en",
    },
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
    locale: "zh_CN",
    alternateLocale: ["en_US"],
    title,
    description,
    images: [
      {
        url: "/og.png",
        width: 1536,
        height: 1024,
        alt: "DeepSeek Harness Plugin Hub — independent community project",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <SiteDocument language="zh-CN">{children}</SiteDocument>;
}
