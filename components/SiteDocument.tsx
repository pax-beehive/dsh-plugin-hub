import { Geist, Geist_Mono } from "next/font/google";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const websiteStructuredData = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": "https://dshpluginhub.ai/#website",
  url: "https://dshpluginhub.ai/",
  name: "DeepSeek Harness Plugin Hub",
  alternateName: "DSH Plugin Hub",
  description:
    "An independent, unofficial community project for DeepSeek Harness plugins and reusable configurations.",
  inLanguage: ["zh-CN", "en"],
  publisher: {
    "@type": "Organization",
    name: "DeepSeek Harness Plugin Hub Community",
    url: "https://dshpluginhub.ai/",
  },
};

export default function SiteDocument({
  children,
  language,
}: Readonly<{
  children: React.ReactNode;
  language: "en" | "zh-CN";
}>) {
  return (
    <html lang={language}>
      {/* The root document owns these non-metadata link relations. */}
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <head>
        <link
          rel="alternate"
          type="text/markdown"
          href="https://dshpluginhub.ai/index.md"
        />
        <link rel="describedby" href="https://dshpluginhub.ai/llms.txt" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(websiteStructuredData),
          }}
        />
        {children}
      </body>
    </html>
  );
}
