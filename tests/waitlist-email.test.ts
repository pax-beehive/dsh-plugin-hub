import assert from "node:assert/strict";
import test from "node:test";
import { interpretCloudflareSendResponse } from "../lib/cloudflare-email-response.ts";

test("a successful Cloudflare message id is accepted while delivery is pending", () => {
  assert.deepEqual(
    interpretCloudflareSendResponse(
      200,
      {
        success: true,
        result: {
          delivered: [],
          message_id: "<accepted-message@example.com>",
          permanent_bounces: [],
          queued: [],
        },
      },
      "reader@example.com",
    ),
    { delivery: "queued" },
  );
});

test("a permanent bounce is not hidden by an accepted message id", () => {
  assert.throws(
    () =>
      interpretCloudflareSendResponse(
        200,
        {
          success: true,
          result: {
            delivered: [],
            message_id: "<bounced-message@example.com>",
            permanent_bounces: ["Reader@Example.com"],
            queued: [],
          },
        },
        "reader@example.com",
      ),
    /email_permanent_bounce/,
  );
});
