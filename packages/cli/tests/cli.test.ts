import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  dshPackageManifestSchema,
  hubListingSchema,
} from "@dsh-plugin-hub/schemas";
import {
  buildDshInstallCommand,
  installResolvedProfile,
  profileLockPath,
} from "../src/index.ts";
import { createPluginStarter } from "../src/scaffold.ts";
import { validatePackageDirectory } from "../src/package-validation.ts";

test("creates a complete schema-valid plugin starter without overwriting files", async () => {
  const root = await mkdtemp(join(tmpdir(), "dsh-hub-starter-"));
  const directory = join(root, "hello-world");
  const result = await createPluginStarter({
    directory,
    packageName: "@example/hello-world",
    repository: "example/hello-world",
    displayName: "Hello World's Plugin",
  });
  const rawPackage = JSON.parse(await readFile(join(directory, "package.json"), "utf8"));
  const manifest = dshPackageManifestSchema.parse(rawPackage);
  const listing = hubListingSchema.parse(manifest.dsh.hub);
  const patch = await readFile(join(directory, "cordis.patch.yml"), "utf8");

  assert.deepEqual(result.files, ["package.json", "cordis.patch.yml", "README.md"]);
  assert.equal(manifest.name, "@example/hello-world");
  assert.equal(listing.displayName, "Hello World's Plugin");
  assert.deepEqual(listing.entryIds, ["example-hello-world"]);
  assert.match(patch, /name: 'Hello World''s Plugin'/);
  const validation = await validatePackageDirectory(directory);
  assert.equal(validation.kind, "plugin");
  assert.equal(validation.name, "@example/hello-world");
  assert.equal(validation.patch, "cordis.patch.yml");
  await assert.rejects(
    createPluginStarter({
      directory,
      packageName: "@example/hello-world",
      repository: "example/hello-world",
    }),
    /Refusing to overwrite/,
  );
});

test("validates an ordered profile and reports implicit latest selectors", async () => {
  const root = await mkdtemp(join(tmpdir(), "dsh-hub-profile-"));
  await writeFile(join(root, "package.json"), JSON.stringify({
    name: "@example/starter-profile",
    version: "1.0.0",
    dependencies: { "dsh-base": "1.2.3" },
    dsh: {
      profile: { bundles: ["dsh-base", "dsh-memory"] },
      hub: { schemaVersion: 1, displayName: "Starter Profile" },
    },
  }), "utf8");

  const result = await validatePackageDirectory(root);
  assert.equal(result.kind, "profile");
  assert.equal(result.bundleCount, 2);
  assert.match(result.warnings.join("\n"), /dsh-memory.*latest/);
});

test("rejects patch traversal before publication", async () => {
  const root = await mkdtemp(join(tmpdir(), "dsh-hub-traversal-"));
  await writeFile(join(root, "package.json"), JSON.stringify({
    name: "dsh-traversal",
    version: "1.0.0",
    repository: "https://github.com/example/dsh-traversal",
    dsh: { bundle: { patch: "../outside.yml" } },
  }), "utf8");
  await assert.rejects(validatePackageDirectory(root), /must stay inside/);
});

test("rejects invalid package and repository identities before creating a starter", async () => {
  const root = await mkdtemp(join(tmpdir(), "dsh-hub-starter-invalid-"));
  await assert.rejects(createPluginStarter({
    directory: join(root, "bad-package"),
    packageName: "Bad Package",
    repository: "example/repository",
  }));
  await assert.rejects(createPluginStarter({
    directory: join(root, "bad-repository"),
    packageName: "valid-package",
    repository: "example",
  }), /owner\/repository/);
});

test("builds the official dsh plugin add command without a shell", () => {
  assert.deepEqual(buildDshInstallCommand("web", "dsh-memory@1.2.3"), {
    command: "dsh",
    args: ["plugin", "--profile", "web", "add", "dsh-memory@1.2.3"],
  });
  assert.throws(() => buildDshInstallCommand("../../web", "dsh-memory"));
  assert.throws(() => buildDshInstallCommand("web", "--config=/tmp/x"));
});

test("dry-run produces commands without touching the profile", async () => {
  const root = await mkdtemp(join(tmpdir(), "dsh-hub-cli-"));
  const result = await installResolvedProfile({
    profile: "web",
    dshHome: root,
    dryRun: true,
    resolved: {
      profileVersion: "1.0.0",
      bundles: [{
        packageName: "dsh-memory",
        selector: "^1.0.0",
        version: "1.2.3",
        installSpec: "dsh-memory@1.2.3",
        integrity: "sha512-example",
        sourceKind: "npm",
      }],
    },
  });

  assert.equal(result.commands.length, 1);
  await assert.rejects(readFile(profileLockPath("web", root)));
});

test("successful installs are executed in profile order and locked", async () => {
  const root = await mkdtemp(join(tmpdir(), "dsh-hub-cli-"));
  const seen: string[] = [];
  await installResolvedProfile({
    profile: "research",
    dshHome: root,
    hubProfileSlug: "research-stack",
    execute: async (command) => { seen.push(command.args.at(-1)!); },
    resolved: {
      profileVersion: "2.0.0",
      bundles: [
        { packageName: "dsh-search", selector: "1.0.0", version: "1.0.0", installSpec: "dsh-search@1.0.0", sourceKind: "npm" },
        { packageName: "dsh-memory", selector: "2.0.0", version: "2.0.0", installSpec: "dsh-memory@2.0.0", sourceKind: "npm" },
      ],
    },
  });

  assert.deepEqual(seen, ["dsh-search@1.0.0", "dsh-memory@2.0.0"]);
  const lock = JSON.parse(await readFile(profileLockPath("research", root), "utf8"));
  assert.equal(lock.hubProfile.slug, "research-stack");
  assert.deepEqual(lock.bundles.map((bundle: { packageName: string }) => bundle.packageName), ["dsh-search", "dsh-memory"]);
});
