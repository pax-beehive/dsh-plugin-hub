import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const categoryPageUrl = new URL(
  "../app/(default)/categories/[category]/page.tsx",
  import.meta.url,
);
const categoriesIndexUrl = new URL(
  "../app/(default)/categories/page.tsx",
  import.meta.url,
);

test("category details paginate against the API total", async () => {
  const source = await readFile(categoryPageUrl, "utf8");

  assert.match(source, /searchParams: Promise<\{ page\?: string \}>/);
  assert.match(source, /page: requestedPage/);
  assert.match(source, /t\.plugins\.totalCount\(result\.total!\)/);
  assert.match(source, /pageWindow\(page, pageCount\)/);
  assert.match(source, /className="catalog-pagination"/);
});

test("category index fetches each category preview from that category", async () => {
  const source = await readFile(categoriesIndexUrl, "utf8");

  assert.match(source, /loadCategoryPreviews\(categories, locale, PREVIEW_LIMIT\)/);
  assert.doesNotMatch(source, /previewByCategory/);
});
