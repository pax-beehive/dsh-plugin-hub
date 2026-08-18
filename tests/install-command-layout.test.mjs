import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const component = readFileSync(
  new URL("../components/CopyCommand.tsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

function rule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return styles.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
}

test("keeps the copy action visible while only the command text scrolls", () => {
  assert.match(component, /className="install-command-scroll"/);

  assert.match(rule(".install-command"), /overflow:\s*hidden/);

  const scrollRule = rule(".install-command-scroll");
  assert.match(scrollRule, /flex:\s*1/);
  assert.match(scrollRule, /min-width:\s*0/);
  assert.match(scrollRule, /overflow-x:\s*auto/);

  assert.match(rule(".install-command button"), /flex:\s*0\s+0\s+auto/);
});
