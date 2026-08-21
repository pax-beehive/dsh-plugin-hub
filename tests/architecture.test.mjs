import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = new URL("../", import.meta.url);

async function sourceFiles(relativeDirectory) {
  const root = fileURLToPath(new URL(`${relativeDirectory}/`, projectRoot));
  const files = [];

  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (/\.(?:ts|tsx)$/.test(entry.name)) files.push(path);
    }
  }

  await visit(root);
  return files;
}

test("web shell has no product database adapter or binding", async () => {
  const [packageJson, hosting, wrangler, vite, ...sourcePaths] = await Promise.all([
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"),
    readFile(new URL("../vite.config.ts", import.meta.url), "utf8"),
    sourceFiles("app"),
    sourceFiles("components"),
    sourceFiles("lib"),
    sourceFiles("worker"),
  ]);

  assert.equal(JSON.parse(hosting).d1, null);
  assert.doesNotMatch(packageJson, /drizzle(?:-orm|-kit)?/i);
  assert.doesNotMatch(wrangler, /d1_databases|migrations_dir/);
  assert.match(wrangler, /"placement"\s*:\s*\{\s*"mode"\s*:\s*"smart"/);
  assert.doesNotMatch(vite, /d1_databases|database_id/);

  for (const path of sourcePaths.flat()) {
    const source = await readFile(path, "utf8");
    assert.doesNotMatch(source, /(?:@\/|\.\.?\/)db(?:\/|["'])/);
    assert.doesNotMatch(source, /from ["']drizzle-orm/);
    assert.doesNotMatch(source, /\benv\.DB\b/);
  }
});
