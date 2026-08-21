import assert from "node:assert/strict";
import test from "node:test";
import { homePageMetadata, notFoundMetadata, pageMetadata } from "../lib/page-metadata.ts";
import { absoluteUrl, SITE_HOME } from "../lib/site-url.ts";

test("homepage metadata self-canonicals with a trailing slash and owns index.md", () => {
  const metadata = homePageMetadata({
    title: "DSH Plugin Hub — DeepSeek Harness Plugins, Profiles & Guides",
    description: "Community registry",
  });

  assert.equal(metadata.alternates?.canonical, SITE_HOME);
  assert.equal(metadata.openGraph?.url, SITE_HOME);
  assert.deepEqual(metadata.alternates?.types, {
    "text/markdown": "https://dshpluginhub.ai/index.md",
  });
  assert.equal(metadata.openGraph?.title, metadata.title);
});

test("inner pages set matching canonical and og:url", () => {
  const metadata = pageMetadata({
    path: "/guides",
    title: "Guides — DSH Plugin Hub",
    description: "Integration guides",
  });

  assert.equal(metadata.alternates?.canonical, "https://dshpluginhub.ai/guides");
  assert.equal(metadata.openGraph?.url, "https://dshpluginhub.ai/guides");
  assert.equal(metadata.openGraph?.title, "Guides — DSH Plugin Hub");
  assert.equal(metadata.alternates?.types, undefined);
  assert.notEqual(metadata.alternates?.canonical, SITE_HOME);
});

test("report is noindex and omitted from markdown alternates", () => {
  const metadata = pageMetadata({
    path: "/report",
    index: false,
    title: "Report an Issue — DeepSeek Harness Plugin Hub",
    description: "Report a plugin issue",
  });

  assert.deepEqual(metadata.robots, { index: false });
  assert.equal(metadata.alternates?.canonical, "https://dshpluginhub.ai/report");
});

test("404 metadata is noindex only and does not reuse the homepage", () => {
  assert.deepEqual(notFoundMetadata.robots, { index: false });
  assert.equal(notFoundMetadata.title, "Not found");
  assert.equal(notFoundMetadata.description, undefined);
  assert.equal(notFoundMetadata.alternates, undefined);
  assert.equal(notFoundMetadata.openGraph, undefined);
  assert.notEqual(notFoundMetadata.title, "DSH Plugin Hub — DeepSeek Harness Plugins, Profiles & Guides");
});

test("absoluteUrl uses the trailing-slash homepage convention", () => {
  assert.equal(absoluteUrl("/"), SITE_HOME);
  assert.equal(absoluteUrl("/guides"), "https://dshpluginhub.ai/guides");
});
