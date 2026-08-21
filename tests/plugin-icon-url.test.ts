import assert from "node:assert/strict";
import test from "node:test";
import { pluginIconUrl } from "../lib/plugin-icon-url.ts";

test("Gravatar icons are normalized to a same-origin cache URL", () => {
  assert.equal(
    pluginIconUrl(
      "https://www.gravatar.com/avatar/2A1454E724832F3B0D3B15C42B347401?s=128&d=retro",
    ),
    "/plugin-icons/gravatar/2a1454e724832f3b0d3b15c42b347401",
  );
});

test("publisher icons stay intact and malformed URLs fall back", () => {
  assert.equal(
    pluginIconUrl("https://example.com/icon.png"),
    "https://example.com/icon.png",
  );
  assert.equal(pluginIconUrl("not a URL"), undefined);
  assert.equal(
    pluginIconUrl("https://evil.example/avatar/2a1454e724832f3b0d3b15c42b347401"),
    "https://evil.example/avatar/2a1454e724832f3b0d3b15c42b347401",
  );
});
