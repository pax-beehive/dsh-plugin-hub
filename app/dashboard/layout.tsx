import SiteDocument from "@/components/SiteDocument";
import { getHubLocale } from "@/lib/i18n-server";
import { siteIcons } from "@/lib/site-icons";
import type { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: "Dashboard — DSH Plugin Hub",
  icons: siteIcons,
  robots: { index: false },
};

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getHubLocale();
  return <SiteDocument language={locale === "en" ? "en" : "zh-CN"}>{children}</SiteDocument>;
}
