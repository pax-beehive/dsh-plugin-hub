import type { Metadata } from "next";
import Home from "../page";

const title = "DeepSeek Harness Plugin Hub — Discover and share plugins";
const description =
  "An independent, unofficial community hub for discovering, sharing, and installing DeepSeek Harness plugins and reusable Harness configurations.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/en",
    languages: {
      "zh-CN": "/",
      en: "/en",
    },
  },
  openGraph: {
    type: "website",
    url: "/en",
    siteName: "DeepSeek Harness Plugin Hub",
    locale: "en_US",
    alternateLocale: ["zh_CN"],
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

export default function EnglishHome() {
  return <Home initialLanguage="en" />;
}
