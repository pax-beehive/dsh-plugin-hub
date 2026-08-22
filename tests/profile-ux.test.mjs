import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Profile Builder blocks publishing until every required field is valid", async () => {
  const builder = await readFile(
    new URL("../components/ProfileBuilder.tsx", import.meta.url),
    "utf8",
  );

  assert.match(builder, /const publishIssue = validate\(\);/);
  assert.match(builder, /id="profile-publish-requirement"/);
  assert.match(builder, /aria-describedby="profile-publish-requirement"/);
  assert.match(builder, /disabled=\{busy \|\| Boolean\(publishIssue\)\}/);
});

test("Profile detail makes the resolved exact version primary", async () => {
  const detail = await readFile(
    new URL("../app/(default)/profiles/[slug]/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(detail, /<code>\{bundle\.version \?\? bundle\.selector\}<\/code>/);
  assert.match(detail, /bundle\.version !== bundle\.selector/);
  assert.match(detail, /resolved from/);
  assert.doesNotMatch(
    detail,
    /<div><strong>\{bundle\.packageName\}<\/strong><code>\{bundle\.selector\}<\/code><\/div>/,
  );
});
