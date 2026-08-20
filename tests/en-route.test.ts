import assert from "node:assert/strict";
import test from "node:test";
import { ATTRIBUTION_COOKIE } from "../lib/attribution.ts";
import { englishHomeRedirect } from "../lib/en-redirect.ts";

function cookies(response: Response): string[] {
  const withSetCookie = response.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof withSetCookie.getSetCookie === "function") {
    return withSetCookie.getSetCookie();
  }
  const value = response.headers.get("set-cookie");
  return value ? [value] : [];
}

test("/en preserves gclid, utm_source, and oppref on the 308", async () => {
  const response = englishHomeRedirect(
    new Request("https://dshpluginhub.ai/en?gclid=abc&utm_source=google&oppref=op_1"),
  );

  assert.equal(response.status, 308);
  assert.equal(
    response.headers.get("location"),
    "https://dshpluginhub.ai/?gclid=abc&utm_source=google&oppref=op_1",
  );

  const setCookie = cookies(response);
  assert.ok(setCookie.some((value) => value.startsWith("dsh-hub-locale=en")));
  const attribution = setCookie.find((value) => value.startsWith(`${ATTRIBUTION_COOKIE}=`));
  assert.ok(attribution);
  assert.match(attribution, /gclid/);
  assert.match(attribution, /oppref/);
  assert.match(attribution, /Max-Age=7776000/);
  assert.match(attribution, /Secure/);
});

test("/en keeps an existing first-touch attribution cookie", async () => {
  const response = englishHomeRedirect(
    new Request("https://dshpluginhub.ai/en?gclid=second", {
      headers: {
        cookie: `${ATTRIBUTION_COOKIE}=${encodeURIComponent("gclid=first&utm_source=google")}`,
      },
    }),
  );

  assert.equal(response.status, 308);
  assert.equal(response.headers.get("location"), "https://dshpluginhub.ai/?gclid=second");
  const attributionCookies = cookies(response).filter((value) =>
    value.startsWith(`${ATTRIBUTION_COOKIE}=`),
  );
  assert.equal(attributionCookies.length, 0);
});
