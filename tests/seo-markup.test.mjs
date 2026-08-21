import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const home = readFileSync(new URL("../components/HomePage.tsx", import.meta.url), "utf8");
const header = readFileSync(new URL("../components/HubHeader.tsx", import.meta.url), "utf8");
const document = readFileSync(new URL("../components/SiteDocument.tsx", import.meta.url), "utf8");
const sitemap = readFileSync(new URL("../app/sitemap.xml/route.ts", import.meta.url), "utf8");
const sitemapLib = readFileSync(new URL("../lib/sitemap.ts", import.meta.url), "utf8");
const wrangler = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");

test("homepage H1 keeps a space between Harness and the registry accent", () => {
  assert.match(home, /\{t\.title\}\{" "\}/);
  assert.match(home, /accent: "plugin registry"/);
  assert.match(home, /Browse plugins/);
  assert.doesNotMatch(home, /Explore Hub/);
  assert.doesNotMatch(home, /accent: "Plugin Hub"/);
  assert.match(home, /<HubHeader locale=\{language\} \/>/);
  assert.match(header, /<nav className="hub-nav"/);
  assert.match(header, /href="\/docs"/);
  assert.match(header, /href="\/status"/);
  assert.match(header, /href="\/profiles"/);
  assert.match(header, /<Link className="brand" href=\{homeHref\}>/);
  assert.match(header, /<HeaderChrome homeHref="\/" locale=\{locale\}>/);
  assert.doesNotMatch(home, /href="#top"/);
  assert.doesNotMatch(home, /priority/);
});

test("hub chrome exposes the complete public-site footer", () => {
  assert.match(header, /href="\/docs"/);
  assert.match(header, /href="\/status"/);
  assert.match(header, /t\.nav\.docs/);
  assert.match(header, /export function HubFooter/);
  assert.match(header, /href="\/privacy"/);
  assert.match(header, /mailto:hello@dshpluginhub\.ai/);
  assert.match(header, /github\.com\/pax-beehive\/dsh-plugin-hub/);
  assert.match(header, /github\.com\/deepseek-ai\/deepseek-harness/);
});

test("markdown alternate is not sitewide in SiteDocument", () => {
  assert.doesNotMatch(document, /rel="alternate"/);
  assert.doesNotMatch(document, /index\.md/);
  assert.match(document, /rel="describedby"/);
  assert.match(document, /llms\.txt/);
});

test("sitemap is a Route Handler urlset and drops /report", () => {
  assert.match(sitemap, /export async function GET/);
  assert.match(sitemap, /listAllPackages/);
  assert.match(sitemap, /application\/xml; charset=utf-8/);
  assert.match(sitemapLib, /sitemapEntriesToXml/);
  assert.doesNotMatch(sitemap, /absoluteUrl\(\"\/report\"\)|\/report`/);
  assert.doesNotMatch(sitemapLib, /absoluteUrl\(\"\/report\"\)|\/report`/);
  assert.match(wrangler, /\/sitemap\/\*/);
  assert.match(wrangler, /"\/status"/);
});

test("public document keeps first-party attribution and defers measurement plus AuthKit", () => {
  const pixels = readFileSync(new URL("../components/AdPixels.tsx", import.meta.url), "utf8");
  const dashboard = readFileSync(new URL("../app/dashboard/layout.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(document, /AuthKitProvider/);
  assert.match(document, /AttributionCapture/);
  assert.match(pixels, /strategy="lazyOnload"/);
  assert.doesNotMatch(pixels, /afterInteractive/);
  assert.match(dashboard, /AuthKitProvider/);
});

test("homepage titles own the registry job and categories is in the sitemap", () => {
  const homePage = readFileSync(new URL("../app/(default)/page.tsx", import.meta.url), "utf8");
  const categoriesIndex = readFileSync(
    new URL("../app/(default)/categories/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(categoriesIndex, /CategoriesIndexPage/);
  assert.match(categoriesIndex, /listCategories/);
  assert.match(categoriesIndex, /searchPackages/);
  assert.match(categoriesIndex, /prefetch=\{false\}/);
  assert.doesNotMatch(categoriesIndex, /notFound\(/);
  assert.match(sitemapLib, /absoluteUrl\("\/categories"\)/);
  assert.match(homePage, /plugin registry — exact versions/);
});

test("homepage official-source arrow is a JS string, not literal JSX text", () => {
  assert.match(home, /officialSource/);
  assert.match(home, /\{\s*["'] \\u2197["']\s*\}/);
  assert.doesNotMatch(home, /> \\u2197</);
});
