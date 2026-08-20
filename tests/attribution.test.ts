import assert from "node:assert/strict";
import test from "node:test";
import {
  ATTRIBUTION_COOKIE,
  attributionBootstrapScript,
  attributionSetCookie,
  captureAttribution,
  canonicalHomeLocation,
  firstTouchAttribution,
  parseAttributionCookie,
  parseAttributionSearch,
  serializeAttribution,
} from "../lib/attribution.ts";

test("parses known paid-click and UTM keys and ignores noise", () => {
  const parsed = parseAttributionSearch(
    "gclid=abc&utm_source=google&utm_medium=cpc&utm_campaign=hub&utm_content=card&utm_term=dsh&wbraid=w1&gbraid=g1&oppref=op_1&fbclid=nope",
  );

  assert.deepEqual(parsed, {
    utm_source: "google",
    utm_medium: "cpc",
    utm_campaign: "hub",
    utm_content: "card",
    utm_term: "dsh",
    gclid: "abc",
    wbraid: "w1",
    gbraid: "g1",
    oppref: "op_1",
  });
});

test("captures landing path and a short referrer host", () => {
  const captured = captureAttribution({
    url: "https://dshpluginhub.ai/en?gclid=abc&utm_source=google&oppref=op_9",
    referrer: "https://chatgpt.com/ads?q=dsh",
  });

  assert.equal(captured.gclid, "abc");
  assert.equal(captured.utm_source, "google");
  assert.equal(captured.oppref, "op_9");
  assert.equal(captured.landing_path, "/en?gclid=abc&utm_source=google&oppref=op_9");
  assert.equal(captured.referrer, "chatgpt.com");
});

test("first-touch does not overwrite an existing attribution cookie", () => {
  const first = captureAttribution({
    url: "https://dshpluginhub.ai/?utm_source=google&gclid=first",
  });
  const cookie = encodeURIComponent(serializeAttribution(first));
  const second = captureAttribution({
    url: "https://dshpluginhub.ai/?utm_source=chatgpt&oppref=later",
  });

  assert.equal(firstTouchAttribution(cookie, second), null);
  assert.equal(parseAttributionCookie(cookie)?.gclid, "first");
  assert.equal(parseAttributionCookie(cookie)?.utm_source, "google");
});

test("first-touch writes when the cookie is missing", () => {
  const incoming = captureAttribution({
    url: "https://dshpluginhub.ai/?gclid=fresh",
  });
  const written = firstTouchAttribution(undefined, incoming);
  assert.equal(written?.gclid, "fresh");
});

test("serializes a first-party cookie with a 90-day lifetime", () => {
  const header = attributionSetCookie(
    { gclid: "abc", landing_path: "/?gclid=abc" },
    { secure: true },
  );
  assert.match(header, new RegExp(`^${ATTRIBUTION_COOKIE}=`));
  assert.match(header, /Path=\//);
  assert.match(header, /Max-Age=7776000/);
  assert.match(header, /SameSite=Lax/);
  assert.match(header, /Secure/);
  assert.equal(parseAttributionCookie(header.split("=", 2)[1]?.split(";", 1)[0])?.gclid, "abc");
});

test("canonical /en redirect keeps paid-click search", () => {
  assert.equal(
    canonicalHomeLocation("https://dshpluginhub.ai/en?gclid=abc&utm_source=google&oppref=op_1"),
    "https://dshpluginhub.ai/?gclid=abc&utm_source=google&oppref=op_1",
  );
  assert.equal(canonicalHomeLocation("https://dshpluginhub.ai/en"), "https://dshpluginhub.ai/");
});

test("bootstrap script is first-touch only and names the cookie", () => {
  const script = attributionBootstrapScript();
  assert.match(script, /dsh-hub-attribution=/);
  assert.match(script, /gclid/);
  assert.match(script, /oppref/);
  assert.match(script, /landing_path/);
  assert.match(script, /if\(document\.cookie\.split/);
});
