import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const home = readFileSync(new URL("../components/HomePage.tsx", import.meta.url), "utf8");
const header = readFileSync(new URL("../components/HubHeader.tsx", import.meta.url), "utf8");
const document = readFileSync(new URL("../components/SiteDocument.tsx", import.meta.url), "utf8");
const sitemap = readFileSync(new URL("../app/sitemap.ts", import.meta.url), "utf8");
const wrangler = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");

test("homepage H1 keeps a space between Harness and Plugin Hub", () => {
  assert.match(home, /\{t\.title\}\{" "\}/);
  assert.match(home, /<HubHeader locale=\{language\} \/>/);
  assert.match(header, /<nav className="hub-nav"/);
  assert.match(header, /href="\/guides"/);
  assert.match(header, /href="\/profiles"/);
  assert.match(header, /<Link className="brand" href=\{homeHref\}>/);
  assert.match(header, /<HeaderChrome homeHref="\/" locale=\{locale\}>/);
  assert.doesNotMatch(home, /href="#top"/);
  assert.doesNotMatch(home, /priority/);
});

test("hub chrome exposes the complete public-site footer", () => {
  assert.match(header, /href="\/guides"/);
  assert.match(header, /t\.nav\.guides/);
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

test("sitemap shards plugin URLs and drops /report", () => {
  assert.match(sitemap, /generateSitemaps/);
  assert.match(sitemap, /listAllPackages/);
  assert.doesNotMatch(sitemap, /absoluteUrl\("\/report"\)|\/report`/);
  assert.match(wrangler, /\/sitemap\/\*/);
});
