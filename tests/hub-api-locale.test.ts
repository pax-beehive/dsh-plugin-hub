import assert from "node:assert/strict";
import test from "node:test";
import { getPackageBySlug, searchPackages } from "../lib/hub-api.ts";

test("searchPackages sends the explicit Chinese locale", async () => {
  const originalFetch = globalThis.fetch;
  const originalOrigin = process.env.HUB_API_ORIGIN;
  let requestedUrl: URL | undefined;
  process.env.HUB_API_ORIGIN = "https://api.example.test";
  globalThis.fetch = async (input) => {
    requestedUrl = new URL(String(input));
    return Response.json({ items: [], nextCursor: null, total: 0 });
  };

  try {
    await searchPackages("memory & context", { locale: "zh" });
    assert.equal(requestedUrl?.pathname, "/api/v1/packages");
    assert.equal(requestedUrl?.searchParams.get("q"), "memory & context");
    assert.equal(requestedUrl?.searchParams.get("locale"), "zh");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalOrigin === undefined) delete process.env.HUB_API_ORIGIN;
    else process.env.HUB_API_ORIGIN = originalOrigin;
  }
});

test("getPackageBySlug sends the explicit Chinese locale", async () => {
  const originalFetch = globalThis.fetch;
  const originalOrigin = process.env.HUB_API_ORIGIN;
  let requestedUrl: URL | undefined;
  process.env.HUB_API_ORIGIN = "https://api.example.test";
  globalThis.fetch = async (input) => {
    requestedUrl = new URL(String(input));
    return new Response("Not found", { status: 404 });
  };

  try {
    assert.equal(await getPackageBySlug("dsh-context", "zh"), null);
    assert.equal(requestedUrl?.pathname, "/api/v1/packages/dsh-context");
    assert.equal(requestedUrl?.searchParams.get("locale"), "zh");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalOrigin === undefined) delete process.env.HUB_API_ORIGIN;
    else process.env.HUB_API_ORIGIN = originalOrigin;
  }
});

test("searchPackages sends the explicit English locale", async () => {
  const originalFetch = globalThis.fetch;
  const originalOrigin = process.env.HUB_API_ORIGIN;
  let requestedUrl: URL | undefined;
  process.env.HUB_API_ORIGIN = "https://api.example.test";
  globalThis.fetch = async (input) => {
    requestedUrl = new URL(String(input));
    return Response.json({ items: [], nextCursor: null, total: 0 });
  };

  try {
    await searchPackages("context", { locale: "en" });
    assert.equal(requestedUrl?.searchParams.get("locale"), "en");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalOrigin === undefined) delete process.env.HUB_API_ORIGIN;
    else process.env.HUB_API_ORIGIN = originalOrigin;
  }
});

test("searchPackages sends the explicit rising sort order", async () => {
  const originalFetch = globalThis.fetch;
  const originalOrigin = process.env.HUB_API_ORIGIN;
  let requestedUrl: URL | undefined;
  process.env.HUB_API_ORIGIN = "https://api.example.test";
  globalThis.fetch = async (input) => {
    requestedUrl = new URL(String(input));
    return Response.json({ items: [], nextCursor: null, total: 0 });
  };

  try {
    await searchPackages("", { locale: "en", sort: "rising" });
    assert.equal(requestedUrl?.searchParams.get("sort"), "rising");
    assert.equal(requestedUrl?.searchParams.get("locale"), "en");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalOrigin === undefined) delete process.env.HUB_API_ORIGIN;
    else process.env.HUB_API_ORIGIN = originalOrigin;
  }
});

test("searchPackages keeps popular as the backend default", async () => {
  const originalFetch = globalThis.fetch;
  const originalOrigin = process.env.HUB_API_ORIGIN;
  let requestedUrl: URL | undefined;
  process.env.HUB_API_ORIGIN = "https://api.example.test";
  globalThis.fetch = async (input) => {
    requestedUrl = new URL(String(input));
    return Response.json({ items: [], nextCursor: null, total: 0 });
  };

  try {
    await searchPackages("", { locale: "zh", sort: "popular" });
    assert.equal(requestedUrl?.searchParams.has("sort"), false);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalOrigin === undefined) delete process.env.HUB_API_ORIGIN;
    else process.env.HUB_API_ORIGIN = originalOrigin;
  }
});
