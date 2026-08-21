import assert from "node:assert/strict";
import test from "node:test";
import { localeFromAcceptLanguage, resolveHubLocale } from "../lib/i18n.ts";

test("cookie en wins over Chinese Accept-Language", () => {
  assert.equal(resolveHubLocale("en", "zh-CN,zh;q=0.9,en;q=0.8"), "en");
});

test("cookie zh wins over English Accept-Language", () => {
  assert.equal(resolveHubLocale("zh", "en-US,en;q=0.9,zh-CN;q=0.8"), "zh");
});

test("no cookie + Chinese-first Accept-Language → zh", () => {
  assert.equal(resolveHubLocale(undefined, "zh-CN,zh;q=0.9,en;q=0.8"), "zh");
  assert.equal(localeFromAcceptLanguage("zh-CN,zh;q=0.9,en;q=0.8"), "zh");
});

test("no cookie + English-first Accept-Language → en even with later zh", () => {
  assert.equal(resolveHubLocale(undefined, "en-US,en;q=0.9,zh-CN;q=0.8"), "en");
  assert.equal(localeFromAcceptLanguage("en-US,en;q=0.9,zh-CN;q=0.8"), "en");
});

test("no cookie + empty or missing Accept-Language → en", () => {
  assert.equal(resolveHubLocale(undefined), "en");
  assert.equal(resolveHubLocale(undefined, null), "en");
  assert.equal(resolveHubLocale(undefined, ""), "en");
  assert.equal(resolveHubLocale(undefined, "   "), "en");
  assert.equal(localeFromAcceptLanguage(undefined), "en");
  assert.equal(localeFromAcceptLanguage(null), "en");
  assert.equal(localeFromAcceptLanguage(""), "en");
});

test("zh-TW and zh-HK are Chinese", () => {
  assert.equal(localeFromAcceptLanguage("zh-TW"), "zh");
  assert.equal(localeFromAcceptLanguage("zh-HK"), "zh");
  assert.equal(resolveHubLocale(undefined, "zh-TW,en;q=0.8"), "zh");
  assert.equal(resolveHubLocale(undefined, "zh-HK,en;q=0.8"), "zh");
});

test("unknown cookie falls through to Accept-Language", () => {
  assert.equal(resolveHubLocale("fr", "zh-CN"), "zh");
  assert.equal(resolveHubLocale("fr", "en-US"), "en");
  assert.equal(resolveHubLocale("fr"), "en");
});
