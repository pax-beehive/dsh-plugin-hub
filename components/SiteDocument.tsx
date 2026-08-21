import AdPixels from "@/components/AdPixels";
import AttributionCapture from "@/components/AttributionCapture";
import { attributionBootstrapScript } from "@/lib/attribution";
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
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://dshpluginhub.ai/#website",
      url: "https://dshpluginhub.ai/",
      name: "DeepSeek Harness Plugin Hub",
      alternateName: "DSH Plugin Hub",
      description:
        "An independent, unofficial community registry for DeepSeek Harness (dsh) plugins and reusable profiles, with exact versions, integrity metadata, and one-command installs.",
      inLanguage: ["zh-CN", "en"],
      publisher: { "@id": "https://dshpluginhub.ai/#organization" },
    },
    {
      "@type": "Organization",
      "@id": "https://dshpluginhub.ai/#organization",
      name: "DeepSeek Harness Plugin Hub Community",
      alternateName: "DSH Plugin Hub",
      url: "https://dshpluginhub.ai/",
      logo: "https://dshpluginhub.ai/og-v2.png",
      email: "hello@dshpluginhub.ai",
    },
  ],
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
          rel="icon"
          href="/deepseek-whale-black.svg?v=2"
          type="image/svg+xml"
          sizes="any"
        />
        <link rel="shortcut icon" href="/deepseek-whale-black.svg?v=2" />
        <link
          rel="apple-touch-icon"
          href="/favicon-64.png?v=2"
          type="image/png"
          sizes="64x64"
        />
        <link rel="describedby" href="https://dshpluginhub.ai/llms.txt" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <script
          dangerouslySetInnerHTML={{ __html: attributionBootstrapScript() }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(websiteStructuredData),
          }}
        />
        <AttributionCapture />
        <AdPixels
          gaMeasurementId={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}
          googleAdsId={process.env.NEXT_PUBLIC_GOOGLE_ADS_ID}
          installLabel={process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL_INSTALL}
          signupLabel={process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL_SIGNUP}
          chatgptPixelId={process.env.NEXT_PUBLIC_CHATGPT_PIXEL_ID}
        />
        {children}
      </body>
    </html>
  );
}
