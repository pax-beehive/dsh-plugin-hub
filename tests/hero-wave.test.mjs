import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const home = readFileSync(new URL("../components/HomePage.tsx", import.meta.url), "utf8");
const wave = readFileSync(new URL("../components/HeroWave.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const plugins = readFileSync(
  new URL("../app/(default)/plugins/page.tsx", import.meta.url),
  "utf8",
);
const categories = readFileSync(
  new URL("../app/(default)/categories/page.tsx", import.meta.url),
  "utf8",
);

function rule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return styles.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
}

test("HomePage is a server component that mounts HeroWave", () => {
  assert.doesNotMatch(home, /["']use client["']/);
  assert.match(home, /import HeroWave from ["']@\/components\/HeroWave["']/);
  assert.match(home, /<HeroWave\s*\/>/);
  assert.match(home, /className="grid-glow"/);
  assert.match(home, /className="whale-watermark"/);
});

test("HeroWave is a WebGL2 client island with reduced-motion and power caps", () => {
  assert.match(wave, /^["']use client["']/);
  assert.match(wave, /getContext\(\s*["']webgl2["']/);
  assert.match(wave, /#version 300 es/);
  assert.match(wave, /prefers-reduced-motion/);
  assert.match(wave, /requestAnimationFrame/);
  assert.match(wave, /document\.hidden/);
  assert.match(wave, /IntersectionObserver/);
  assert.match(wave, /powerPreference:\s*["']low-power["']/);
  assert.match(wave, /1\.5/);
  assert.match(wave, /1000 \/ 30/);
  assert.match(wave, /pointer:\s*coarse/);
  assert.match(wave, /aria-hidden/);
  assert.match(wave, /\bfbm\b/);
  assert.match(wave, /curl/i);
  assert.match(wave, /FLOW_SCALE = 4/);
  assert.doesNotMatch(wave, /from ["']three(?:\/.+)?["']/);
  assert.doesNotMatch(wave, /THREE\./);
});

test("hero-wave CSS is a full-bleed inert layer", () => {
  const body = rule(".hero-wave");
  assert.match(body, /position:\s*absolute/);
  assert.match(body, /inset:\s*0/);
  assert.match(body, /width:\s*100%/);
  assert.match(body, /height:\s*100%/);
  assert.match(body, /display:\s*block/);
  assert.match(body, /z-index:\s*0/);
  assert.match(body, /pointer-events:\s*none/);
});

test("catalog heroes do not mount HeroWave", () => {
  assert.doesNotMatch(plugins, /HeroWave/);
  assert.doesNotMatch(categories, /HeroWave/);
});
