#!/usr/bin/env node
import { parseArgs } from "node:util";
import { basename, resolve } from "node:path";
import { resolveProfile, resolvePluginVersion } from "@dsh-plugin-hub/registry";
import { HubApiClient } from "./api-client.js";
import { buildDshInstallCommand, installResolvedProfile } from "./index.js";
import { createPluginStarter } from "./scaffold.js";
import { validatePackageDirectory } from "./package-validation.js";

const usage = `dsh-hub — DeepSeek Harness plugin and profile client

Usage:
  dsh-hub init [directory] --repository <owner/repository> [--name <npm-package>]
  dsh-hub validate [directory] [--json]
  dsh-hub search <query> [--json]
  dsh-hub info <package> [--version <selector>] [--json]
  dsh-hub install <package> [--version <selector>] [--profile web] [--dry-run]
  dsh-hub profile search <query> [--json]
  dsh-hub profile apply <slug> [--version <version>] [--profile web] [--dry-run]

Options:
  --api <url>       Hub API base URL
  --name <package>  npm package name for a generated starter
  --repository <r>  Public GitHub owner/repository for a generated starter
  --display-name <n> Human-readable name for a generated starter
  --profile <name>  Target DSH profile (default: web)
  --version <value> Exact version, dist-tag, or semver range
  --dry-run         Print the resolved commands without changing the profile
  --json            Print machine-readable output
`;

function print(value: unknown, json: boolean) {
  if (json) console.log(JSON.stringify(value, null, 2));
  else if (typeof value === "string") console.log(value);
  else console.log(JSON.stringify(value, null, 2));
}

async function main() {
  const parsed = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: {
      api: { type: "string" },
      name: { type: "string" },
      repository: { type: "string" },
      "display-name": { type: "string" },
      profile: { type: "string", default: "web" },
      version: { type: "string", default: "latest" },
      "dry-run": { type: "boolean", default: false },
      json: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });
  const [command, subject, value] = parsed.positionals;
  const json = parsed.values.json ?? false;
  if (parsed.values.help || !command) {
    console.log(usage);
    return;
  }

  const client = new HubApiClient(parsed.values.api ?? process.env.DSH_HUB_API_URL);
  if (command === "init") {
    const directory = subject ?? ".";
    if (!parsed.values.repository) {
      throw new Error("init requires --repository <owner/repository>");
    }
    const packageName = parsed.values.name ?? basename(resolve(directory));
    const result = await createPluginStarter({
      directory,
      packageName,
      repository: parsed.values.repository,
      displayName: parsed.values["display-name"],
    });
    if (json) print(result, true);
    else {
      console.log(`Created ${result.packageName} in ${result.directory}`);
      for (const file of result.files) console.log(`  ${file}`);
      console.log("\nNext:");
      for (const nextCommand of result.nextCommands) console.log(`  ${nextCommand}`);
    }
    return;
  }

  if (command === "validate") {
    const result = await validatePackageDirectory(subject ?? ".");
    if (json) print(result, true);
    else {
      console.log(`Valid ${result.kind}: ${result.name}@${result.version}`);
      if (result.patch) console.log(`  patch: ${result.patch}`);
      if (result.bundleCount !== undefined) console.log(`  bundles: ${result.bundleCount}`);
      for (const warning of result.warnings) console.log(`  warning: ${warning}`);
    }
    return;
  }

  if (command === "search") {
    const result = await client.search(parsed.positionals.slice(1).join(" "));
    if (json) print(result, true);
    else for (const item of result.items) console.log(`${item.packageName}\t${item.latestVersion}\t${item.summary}`);
    return;
  }

  if (command === "info" && subject) {
    const plugin = await client.package(subject);
    const selected = resolvePluginVersion(plugin, parsed.values.version);
    print({ ...plugin, selectedVersion: selected }, json);
    return;
  }

  if (command === "install" && subject) {
    const plugin = await client.package(subject);
    const selected = resolvePluginVersion(plugin, parsed.values.version);
    const install = buildDshInstallCommand(parsed.values.profile, selected.source.installSpec);
    if (parsed.values["dry-run"]) {
      print({ plugin: plugin.packageName, version: selected.version, command: [install.command, ...install.args] }, json);
      return;
    }
    await installResolvedProfile({
      profile: parsed.values.profile,
      resolved: {
        profileVersion: selected.version,
        bundles: [{
          packageName: plugin.packageName,
          selector: parsed.values.version,
          version: selected.version,
          installSpec: selected.source.installSpec,
          integrity: selected.source.kind === "github" ? undefined : selected.source.integrity,
          sourceKind: selected.source.kind,
        }],
      },
    });
    return;
  }

  if (command === "profile" && subject === "apply" && value) {
    const profile = await client.profile(value);
    const selected = parsed.values.version === "latest"
      ? profile.versions.find((candidate) => candidate.version === profile.latestVersion)
      : profile.versions.find((candidate) => candidate.version === parsed.values.version);
    if (!selected) throw new Error(`Profile ${value} has no version ${parsed.values.version}`);
    const records = await Promise.all(selected.bundles.map((bundle) => client.package(bundle.packageName)));
    const resolved = resolveProfile(selected, new Map(records.map((record) => [record.packageName, record])));
    const result = await installResolvedProfile({
      profile: parsed.values.profile,
      resolved,
      hubProfileSlug: profile.slug,
      dryRun: parsed.values["dry-run"],
    });
    if (parsed.values["dry-run"] || json) {
      print({
        profile: profile.slug,
        version: selected.version,
        commands: result.commands.map((item) => [item.command, ...item.args]),
        lockfile: result.lockfile,
      }, json);
    }
    return;
  }

  if (command === "profile" && subject === "search") {
    const result = await client.profiles(parsed.positionals.slice(2).join(" "));
    if (json) print(result, true);
    else for (const item of result.items) console.log(`${item.slug}\t${item.latestVersion}\t${item.name}`);
    return;
  }

  throw new Error(`Unknown or incomplete command\n\n${usage}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
