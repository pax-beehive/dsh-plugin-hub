import SiteDocument from "@/components/SiteDocument";
import type { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://dshpluginhub.ai"),
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
  ],
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
};

export default function EnglishRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <SiteDocument language="en">{children}</SiteDocument>;
}
