import assert from "node:assert/strict";
import test from "node:test";
import { homePageMetadata, notFoundMetadata, pageMetadata } from "../lib/page-metadata.ts";
import { absoluteUrl, SITE_HOME } from "../lib/site-url.ts";

test("homepage metadata self-canonicals with a trailing slash and owns index.md", () => {
  const metadata = homePageMetadata({
    title: "DSH plugin registry — exact versions, manifests, one-command installs",
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
    path: "/docs",
    title: "Documentation — DSH Plugin Hub",
    description: "User documentation",
  });

  assert.equal(metadata.alternates?.canonical, "https://dshpluginhub.ai/docs");
  assert.equal(metadata.openGraph?.url, "https://dshpluginhub.ai/docs");
  assert.equal(metadata.openGraph?.title, "Documentation — DSH Plugin Hub");
  assert.equal(metadata.alternates?.types, undefined);
  assert.notEqual(metadata.alternates?.canonical, SITE_HOME);
});

test("status page sets matching canonical and og:url", () => {
  const metadata = pageMetadata({
    path: "/status",
    title: "Status — DSH Plugin Hub",
    description: "Pipeline status",
  });

  assert.equal(metadata.alternates?.canonical, "https://dshpluginhub.ai/status");
  assert.equal(metadata.openGraph?.url, "https://dshpluginhub.ai/status");
  assert.equal(metadata.openGraph?.title, "Status — DSH Plugin Hub");
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
  assert.notEqual(notFoundMetadata.title, "DSH plugin registry — exact versions, manifests, one-command installs");
});

test("absoluteUrl uses the trailing-slash homepage convention", () => {
  assert.equal(absoluteUrl("/"), SITE_HOME);
  assert.equal(absoluteUrl("/docs"), "https://dshpluginhub.ai/docs");
  assert.equal(absoluteUrl("/status"), "https://dshpluginhub.ai/status");
});
