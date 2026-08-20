export const SITE_ORIGIN = "https://dshpluginhub.ai";

/** Canonical homepage URL. Trailing slash is the sitewide convention. */
export const SITE_HOME = `${SITE_ORIGIN}/`;

export const OG_IMAGE_PATH = "/og-v2.png";
export const OG_IMAGE_URL = `${SITE_ORIGIN}${OG_IMAGE_PATH}`;
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;
export const MARKDOWN_HOME = `${SITE_ORIGIN}/index.md`;
export const LLMS_TXT = `${SITE_ORIGIN}/llms.txt`;

export function absoluteUrl(path: string): string {
  if (path === "/" || path === "") return SITE_HOME;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_ORIGIN}${normalized}`;
}
