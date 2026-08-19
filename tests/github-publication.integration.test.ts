import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import test from "node:test";
import { drizzle } from "drizzle-orm/d1";
import { D1IdentityStore } from "../db/identity-store.ts";
import { D1PublicationStore } from "../db/publication-store.ts";
import { D1RegistryStore } from "../db/registry-store.ts";
import * as schema from "../db/schema.ts";
import {
  GitHubPublicationError,
  publishGitHubRepository,
} from "../lib/github-publication.ts";
import { createTestD1 } from "./helpers/sqlite-d1.ts";

const now = Date.UTC(2026, 7, 18, 12, 0, 0);
const commit = "0123456789abcdef0123456789abcdef01234567";
const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

async function createFixture(isPrivate = false) {
  const { sqlite, binding } = await createTestD1();
  const db = drizzle(binding, { schema });
  const identityStore = new D1IdentityStore(db);
  await identityStore.upsertWorkosUser({
    id: "user_01",
    email: "publisher@example.com",
    name: "Publisher",
    firstName: null,
    lastName: null,
    profilePictureUrl: null,
  });
  await identityStore.saveInstallation("user_01", {
    id: 154_560_008,
    accountLogin: "example",
    targetType: "User",
    repositorySelection: "selected",
    suspendedAt: null,
    repositories: [
      {
        id: 99,
        fullName: "example/dsh-greeter",
        isPrivate,
        defaultBranch: "main",
      },
    ],
  });
  return {
    sqlite,
    identityStore,
    publicationStore: new D1PublicationStore(db),
    registryStore: new D1RegistryStore(db),
  };
}

function githubFetcher(packageJson: unknown, hubListing: unknown): typeof fetch {
  return async (input) => {
    const url = String(input);
    if (url.includes("/app/installations/154560008/access_tokens")) {
      return Response.json({
        token: "installation-token",
        expires_at: "2026-08-18T13:00:00Z",
      });
    }
    if (url.endsWith("/repos/example/dsh-greeter")) {
      return Response.json({
        full_name: "example/dsh-greeter",
        private: false,
        default_branch: "main",
      });
    }
    if (url.includes("/commits/main")) return Response.json({ sha: commit });
    if (url.includes("/contents/package.json")) return githubFile(packageJson);
    if (url.includes("/contents/dsh-hub.json")) return githubFile(hubListing);
    if (url.includes("registry.npmjs.org")) {
      return Response.json({
        gitHead: commit,
        dist: {
          tarball: "https://registry.npmjs.org/dsh-greeter/-/dsh-greeter-1.2.3.tgz",
          integrity: "sha512-test",
          unpackedSize: 42_000,
          fileCount: 12,
        },
      });
    }
    return new Response(null, { status: 404 });
  };
}

function githubFile(value: unknown) {
  return Response.json({
    type: "file",
    encoding: "base64",
    content: Buffer.from(JSON.stringify(value)).toString("base64"),
  });
}

test("authorized GitHub bundle import verifies npm provenance and publishes an immutable version", async (t) => {
  const fixture = await createFixture();
  t.after(() => fixture.sqlite.close());
  const packageJson = {
    name: "dsh-greeter",
    version: "1.2.3",
    description: "Greets every new DSH session",
    license: "MIT",
    dsh: { bundle: { patch: "./cordis.patch.yml" } },
    privateBuildMetadata: { token: "must-not-be-public" },
  };
  const fetcher = githubFetcher(packageJson, {
    schemaVersion: 1,
    displayName: "Greeter",
    summary: "Friendly startup messages",
    categories: ["workflow"],
    compatibility: {
      dsh: ">=0.1.0-rc.7",
      platforms: [],
      surfaces: ["any"],
      hmr: "config",
    },
  });
  const input = {
    workosUserId: "user_01",
    repository: "example/dsh-greeter",
    appId: 4_631_702,
    privateKey: privateKeyPem,
    identityStore: fixture.identityStore,
    publicationStore: fixture.publicationStore,
    fetcher,
    now,
  };

  const first = await publishGitHubRepository(input);
  const second = await publishGitHubRepository(input);
  const plugin = await fixture.registryStore.findPackage("dsh-greeter");

  assert.deepEqual(first, { kind: "plugin", slug: "dsh-greeter", version: "1.2.3", created: true });
  assert.equal(second.created, false);
  assert.equal(plugin?.displayName, "Greeter");
  assert.equal(plugin?.claimed, true);
  assert.equal(plugin?.versions[0]?.source.kind, "npm");
  assert.equal(plugin?.versions[0]?.compatibility.hmr, "config");
  assert.equal(plugin?.versions[0]?.unpackedSize, 42_000);
  assert.equal(plugin?.versions[0]?.fileCount, 12);
  const publicManifest = plugin?.versions[0]?.manifest as Record<string, unknown>;
  assert.equal(publicManifest.privateBuildMetadata, undefined);
});

test("authorized GitHub profile import preserves declared bundle order", async (t) => {
  const fixture = await createFixture();
  t.after(() => fixture.sqlite.close());
  const result = await publishGitHubRepository({
    workosUserId: "user_01",
    repository: "example/dsh-greeter",
    appId: 4_631_702,
    privateKey: privateKeyPem,
    identityStore: fixture.identityStore,
    publicationStore: fixture.publicationStore,
    fetcher: githubFetcher(
      {
        name: "dsh-starter-profile",
        version: "2.0.0",
        private: false,
        dependencies: { "dsh-greeter": "1.2.3", "dsh-tools": "^3.0.0" },
        dsh: { profile: { bundles: ["dsh-tools", "dsh-greeter"] } },
      },
      { schemaVersion: 1, displayName: "Starter Profile" },
    ),
    now,
  });
  const profile = await fixture.registryStore.findProfile("dsh-starter-profile");

  assert.equal(result.kind, "profile");
  assert.deepEqual(
    profile?.versions[0]?.bundles.map((bundle) => [bundle.packageName, bundle.selector]),
    [["dsh-tools", "^3.0.0"], ["dsh-greeter", "1.2.3"]],
  );
});

test("private repositories are rejected before minting an installation token", async (t) => {
  const fixture = await createFixture(true);
  t.after(() => fixture.sqlite.close());
  let fetched = false;

  await assert.rejects(
    publishGitHubRepository({
      workosUserId: "user_01",
      repository: "example/dsh-greeter",
      appId: 4_631_702,
      privateKey: privateKeyPem,
      identityStore: fixture.identityStore,
      publicationStore: fixture.publicationStore,
      fetcher: async () => {
        fetched = true;
        return new Response(null, { status: 500 });
      },
      now,
    }),
    (error: unknown) =>
      error instanceof GitHubPublicationError &&
      error.code === "private_repository_not_supported",
  );
  assert.equal(fetched, false);
});
