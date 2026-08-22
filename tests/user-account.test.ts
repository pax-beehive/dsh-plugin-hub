import assert from "node:assert/strict";
import test from "node:test";
import {
  accountInitials,
  hubAccountFromUser,
  safeAvatarUrl,
} from "../lib/user-account.ts";

test("builds a localized account presentation from a WorkOS user", () => {
  assert.deepEqual(
    hubAccountFromUser({
      email: "todd@example.com",
      firstName: "Todd",
      lastName: "Zheng",
      profilePictureUrl: "https://workoscdn.com/images/v1/todd.png",
    }),
    {
      avatarUrl: "https://workoscdn.com/images/v1/todd.png",
      displayName: "Todd Zheng",
      email: "todd@example.com",
      initials: "TZ",
    },
  );
  assert.equal(accountInitials("郑涛", "todd@example.com"), "郑");
});

test("falls back to email and rejects unsafe avatar protocols", () => {
  assert.deepEqual(hubAccountFromUser({ email: "user@example.com" }), {
    avatarUrl: null,
    displayName: "user@example.com",
    email: "user@example.com",
    initials: "U",
  });
  assert.equal(safeAvatarUrl("javascript:alert(1)"), null);
  assert.equal(safeAvatarUrl("http://workoscdn.com/images/user.png"), null);
  assert.equal(safeAvatarUrl("https://images.example.com/user.png"), null);
  assert.equal(safeAvatarUrl("not a url"), null);
});
