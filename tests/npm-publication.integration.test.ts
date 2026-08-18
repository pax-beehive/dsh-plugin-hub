import assert from "node:assert/strict";
import test from "node:test";
import { drizzle } from "drizzle-orm/d1";
import { D1IdentityStore } from "../db/identity-store.ts";
import { D1PublicationStore } from "../db/publication-store.ts";
import { D1RegistryStore } from "../db/registry-store.ts";
import * as schema from "../db/schema.ts";
import {
  NpmPublicationError,
  publishNpmPackage,
} from "../lib/npm-publication.ts";
import { createTestD1 } from "./helpers/sqlite-d1.ts";

const now = Date.UTC(2026, 7, 18, 12, 0, 0);

async function createFixture() {
  const { sqlite, binding } = await createTestD1();
  const db = drizzle(binding, { schema });
  await new D1IdentityStore(db).upsertWorkosUser({
    id: "user_01",
    email: "publisher@example.com",
    name: "Publisher",
    firstName: null,
    lastName: null,
    profilePictureUrl: null,
  });
  return {
    sqlite,
    publicationStore: new D1PublicationStore(db),
    registryStore: new D1RegistryStore(db),
  };
}

test("a signed-in publisher can import an exact DSH plugin version from npm", async (t) => {
  const fixture = await createFixture();
  t.after(() => fixture.sqlite.close());
  const requests: string[] = [];
  const result = await publishNpmPackage({
    workosUserId: "user_01",
    packageName: "dsh-greeter",
    version: "latest",
    publicationStore: fixture.publicationStore,
    now,
    fetcher: async (input) => {
      requests.push(String(input));
      return Response.json({
        name: "dsh-greeter",
        version: "1.2.3",
        description: "Greets every new DSH session",
        license: "MIT",
        repository: {
          type: "git",
          url: "git+https://github.com/example/dsh-greeter.git",
        },
        dsh: {
          bundle: { patch: "./cordis.patch.yml" },
          hub: {
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
          },
        },
        dist: {
          tarball: "https://registry.npmjs.org/dsh-greeter/-/dsh-greeter-1.2.3.tgz",
          integrity: "sha512-test",
          unpackedSize: 42_000,
          fileCount: 12,
        },
        maintainers: [{ name: "publisher", email: "private@example.com" }],
        _npmUser: { name: "publisher", email: "private@example.com" },
        _npmOperationalInternal: { host: "internal" },
      });
    },
  });
  const plugin = await fixture.registryStore.findPackage("dsh-greeter");

  assert.deepEqual(result, {
    kind: "plugin",
    slug: "dsh-greeter",
    version: "1.2.3",
    created: true,
  });
  assert.deepEqual(requests, ["https://registry.npmjs.org/dsh-greeter/latest"]);
  assert.equal(plugin?.displayName, "Greeter");
  assert.equal(plugin?.repository, "example/dsh-greeter");
  assert.equal(plugin?.versions[0]?.source.kind, "npm");
  assert.equal(plugin?.versions[0]?.source.installSpec, "dsh-greeter@1.2.3");
  assert.equal(plugin?.versions[0]?.compatibility.hmr, "config");
  const publicManifest = plugin?.versions[0]?.manifest as Record<string, unknown>;
  assert.equal(publicManifest.maintainers, undefined);
  assert.equal(publicManifest._npmUser, undefined);
  assert.equal(publicManifest._npmOperationalInternal, undefined);
  assert.equal(publicManifest.dist, undefined);
});

test("npm profile import preserves declared bundle order", async (t) => {
  const fixture = await createFixture();
  t.after(() => fixture.sqlite.close());
  const result = await publishNpmPackage({
    workosUserId: "user_01",
    packageName: "dsh-starter-profile",
    publicationStore: fixture.publicationStore,
    publisherName: "Publisher",
    now,
    fetcher: async () => Response.json({
      name: "dsh-starter-profile",
      version: "2.0.0",
      dependencies: { "dsh-greeter": "1.2.3", "dsh-tools": "^3.0.0" },
      dsh: {
        profile: { bundles: ["dsh-tools", "dsh-greeter"] },
        hub: { schemaVersion: 1, displayName: "Starter Profile" },
      },
      dist: {
        tarball: "https://registry.npmjs.org/dsh-starter-profile/-/dsh-starter-profile-2.0.0.tgz",
        integrity: "sha512-profile",
      },
    }),
  });
  const profile = await fixture.registryStore.findProfile("dsh-starter-profile");

  assert.equal(result.kind, "profile");
  assert.equal(profile?.owner, "Publisher");
  assert.deepEqual(
    profile?.versions[0]?.bundles.map((bundle) => [bundle.packageName, bundle.selector]),
    [["dsh-tools", "^3.0.0"], ["dsh-greeter", "1.2.3"]],
  );
});

test("npm import rejects registry identity substitution", async (t) => {
  const fixture = await createFixture();
  t.after(() => fixture.sqlite.close());

  await assert.rejects(
    publishNpmPackage({
      workosUserId: "user_01",
      packageName: "dsh-greeter",
      publicationStore: fixture.publicationStore,
      fetcher: async () => Response.json({
        name: "another-package",
        version: "1.2.3",
        dsh: { bundle: { patch: "./cordis.patch.yml" } },
        dist: { tarball: "https://registry.npmjs.org/another-package/-/another-package-1.2.3.tgz" },
      }),
    }),
    (error: unknown) =>
      error instanceof NpmPublicationError &&
      error.code === "package_identity_mismatch",
  );
});
