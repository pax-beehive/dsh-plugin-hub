import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ResolvedProfile, ResolvedProfileBundle } from "@dsh-plugin-hub/registry";

export interface DshInstallCommand {
  command: "dsh";
  args: string[];
}

export interface HubLockfile {
  schemaVersion: 1;
  profile: string;
  hubProfile?: { slug: string; version: string };
  resolvedAt: string;
  bundles: ResolvedProfileBundle[];
}

export function buildDshInstallCommand(
  profile: string,
  installSpec: string,
): DshInstallCommand {
  if (!/^[A-Za-z0-9._-]+$/.test(profile)) {
    throw new Error(`Invalid DSH profile name: ${profile}`);
  }
  if (installSpec.trim() === "" || installSpec.startsWith("-")) {
    throw new Error(`Invalid install spec: ${installSpec}`);
  }
  return {
    command: "dsh",
    args: ["plugin", "--profile", profile, "add", installSpec],
  };
}

export function profileLockPath(profile: string, dshHome?: string): string {
  return join(dshHome ?? process.env.DSH_HOME ?? join(homedir(), ".dsh"), "profiles", profile, "dsh-hub.lock.json");
}

function run(command: DshInstallCommand): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command.command, command.args, {
      stdio: "inherit",
      env: process.env,
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`dsh install failed (${signal ?? `exit ${String(code)}`})`));
    });
  });
}

export async function installResolvedProfile(options: {
  profile: string;
  resolved: ResolvedProfile;
  hubProfileSlug?: string;
  dryRun?: boolean;
  dshHome?: string;
  execute?: (command: DshInstallCommand) => Promise<void>;
}): Promise<{ commands: DshInstallCommand[]; lockfile: HubLockfile }> {
  const commands = options.resolved.bundles.map((bundle) =>
    buildDshInstallCommand(options.profile, bundle.installSpec),
  );
  const lockfile: HubLockfile = {
    schemaVersion: 1,
    profile: options.profile,
    hubProfile: options.hubProfileSlug
      ? { slug: options.hubProfileSlug, version: options.resolved.profileVersion }
      : undefined,
    resolvedAt: new Date().toISOString(),
    bundles: options.resolved.bundles,
  };

  if (!options.dryRun) {
    for (const command of commands) await (options.execute ?? run)(command);
    const path = profileLockPath(options.profile, options.dshHome);
    await mkdir(join(path, ".."), { recursive: true });
    await writeFile(path, `${JSON.stringify(lockfile, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
  }

  return { commands, lockfile };
}
