import assert from "node:assert/strict";
import test from "node:test";
import { drizzle } from "drizzle-orm/d1";
import { D1IdentityStore } from "../db/identity-store.ts";
import * as schema from "../db/schema.ts";
import { createTestD1 } from "./helpers/sqlite-d1.ts";

test("identity store upserts a WorkOS user and replaces GitHub repository access", async (t) => {
  const { sqlite, binding } = await createTestD1();
  t.after(() => sqlite.close());
  const store = new D1IdentityStore(drizzle(binding, { schema }));

  await store.upsertWorkosUser({
    id: "user_01",
    email: "Publisher@Example.com",
    name: null,
    firstName: "DSH",
    lastName: "Publisher",
    profilePictureUrl: "https://example.com/avatar.png",
  });
  await store.saveInstallation("user_01", {
    id: 154_560_008,
    accountLogin: "pax-beehive",
    targetType: "Organization",
    repositorySelection: "selected",
    suspendedAt: null,
    repositories: [
      {
        id: 99,
        fullName: "pax-beehive/dsh-plugin-hub",
        isPrivate: true,
        defaultBranch: "main",
      },
    ],
  });

  const user = sqlite.prepare("SELECT * FROM hub_users").get() as Record<string, unknown>;
  const installation = sqlite.prepare("SELECT * FROM github_installations").get() as Record<string, unknown>;
  const repositories = sqlite
    .prepare("SELECT full_name FROM github_installation_repositories")
    .all() as Array<Record<string, unknown>>;
  assert.equal(user.email, "publisher@example.com");
  assert.equal(user.display_name, "DSH Publisher");
  assert.equal(installation.account_login, "pax-beehive");
  assert.deepEqual(
    repositories.map((repository) => repository.full_name),
    ["pax-beehive/dsh-plugin-hub"],
  );

  await store.saveInstallation("user_01", {
    id: 154_560_008,
    accountLogin: "pax-beehive",
    targetType: "Organization",
    repositorySelection: "selected",
    suspendedAt: null,
    repositories: [],
  });
  const remaining = sqlite
    .prepare("SELECT COUNT(*) AS count FROM github_installation_repositories")
    .get() as { count: number };
  assert.equal(remaining.count, 0);
});
