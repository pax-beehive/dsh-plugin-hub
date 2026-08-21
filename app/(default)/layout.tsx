import SiteDocument from "@/components/SiteDocument";
import { HubFooter } from "@/components/HubHeader";
import { getHubLocale } from "@/lib/i18n-server";
import {
  OG_IMAGE_HEIGHT,
  OG_IMAGE_PATH,
  OG_IMAGE_WIDTH,
  SITE_HOME,
} from "@/lib/site-url";
import { siteIcons } from "@/lib/site-icons";
import type { Metadata } from "next";
import "../globals.css";

const siteUrl = new URL(SITE_HOME);
const localizedMetadata = {
  zh: {
    locale: "zh_CN",
    alternateLocale: ["en_US"],
  },
  en: {
    locale: "en_US",
    alternateLocale: ["zh_CN"],
  },
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getHubLocale();
  const copy = localizedMetadata[locale];
  return {
    metadataBase: siteUrl,
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
    icons: siteIcons,
    openGraph: {
      type: "website",
      siteName: "DeepSeek Harness Plugin Hub",
      locale: copy.locale,
      alternateLocale: [...copy.alternateLocale],
      images: [
        {
          url: OG_IMAGE_PATH,
          width: OG_IMAGE_WIDTH,
          height: OG_IMAGE_HEIGHT,
          alt: "DeepSeek Harness Plugin Hub — independent community project",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      images: [OG_IMAGE_PATH],
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getHubLocale();
  return (
    <SiteDocument language={locale === "en" ? "en" : "zh-CN"}>
      {children}
      <HubFooter locale={locale} />
    </SiteDocument>
  );
}
