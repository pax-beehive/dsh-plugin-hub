import assert from "node:assert/strict";
import test from "node:test";
import robots from "../app/robots.ts";

test("ads crawlers are allowed the public catalog like OAI-SearchBot", () => {
  const result = robots();
  const rules = result.rules;
  const listed = Array.isArray(rules) ? rules : [rules];
  const byAgent = new Map(
    listed.map((rule) => [rule.userAgent, rule]),
  );

  for (const agent of ["OAI-SearchBot", "OAI-AdsBot", "AdsBot-Google"]) {
    const rule = byAgent.get(agent);
    assert.ok(rule, `missing ${agent}`);
    assert.equal(rule?.allow, "/");
    assert.deepEqual(rule?.disallow, ["/dashboard", "/api/", "/integrations/"]);
  }
});

test("robots still points at the production sitemap", () => {
  const result = robots();
  assert.equal(result.sitemap, "https://dshpluginhub.ai/sitemap.xml");
});
