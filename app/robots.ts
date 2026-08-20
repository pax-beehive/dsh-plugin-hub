import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const sharedDisallow = ["/dashboard", "/api/", "/integrations/"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: sharedDisallow },
      { userAgent: "OAI-SearchBot", allow: "/", disallow: sharedDisallow },
      { userAgent: "Claude-SearchBot", allow: "/", disallow: sharedDisallow },
      { userAgent: "PerplexityBot", allow: "/", disallow: sharedDisallow },
    ],
    sitemap: "https://dshpluginhub.ai/sitemap.xml",
  };
}
