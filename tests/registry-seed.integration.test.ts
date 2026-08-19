import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { drizzle } from "drizzle-orm/d1";
import { D1RegistryStore } from "../db/registry-store.ts";
import * as schema from "../db/schema.ts";
import { createTestD1 } from "./helpers/sqlite-d1.ts";

test("curated staging seed is idempotent and schema-valid", async (t) => {
  const { sqlite, binding } = await createTestD1();
  t.after(() => sqlite.close());
  const seed = await readFile(
    new URL("../scripts/seeds/community-plugins.sql", import.meta.url),
    "utf8",
  );
  sqlite.exec(seed);
  sqlite.exec(seed);
  const store = new D1RegistryStore(drizzle(binding, { schema }));

  const exporter = await store.findPackage("dsh-conversation-exporter");
  const imageGen = await store.findPackage("dsh-image-gen");
  const vision = await store.findPackage("dsh-deepseek-vision");

  assert.equal(exporter?.latestVersion, "0.2.0");
  assert.equal(exporter?.versions[0]?.source.kind, "npm");
  assert.equal(exporter?.versions[0]?.unpackedSize, 38_537);
  assert.equal(imageGen?.versions[0]?.fileCount, 17);
  assert.equal(vision?.versions[0]?.source.installSpec, "dsh-deepseek-vision@0.1.5");
  assert.equal(await store.findPackage("dshmarket"), null);
  assert.equal(await store.findProfile("starter-web"), null);
});
