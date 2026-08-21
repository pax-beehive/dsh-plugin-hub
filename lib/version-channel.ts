export type VersionChannelLabel = "stable" | "beta" | "dev" | "prerelease";

function prereleaseId(version: string): string | null {
  const core = version.split("+", 1)[0] ?? version;
  const dash = core.indexOf("-");
  if (dash === -1) return null;
  return core.slice(dash + 1).toLowerCase();
}

/** Label a version from its semver prerelease id. Do not invent API channels. */
export function versionChannelLabel(version: string): VersionChannelLabel {
  const pre = prereleaseId(version);
  if (!pre) return "stable";
  const token = pre.split(/[.-]/)[0] ?? pre;
  if (token === "beta") return "beta";
  if (token === "dev") return "dev";
  return "prerelease";
}

export function isPrereleaseVersion(version: string): boolean {
  return versionChannelLabel(version) !== "stable";
}

export function partitionVersionRows<T extends { version: string }>(
  versionsNewestFirst: T[],
  latestVersion: string,
  visibleStableLimit = 3,
): { visible: T[]; hidden: T[] } {
  const visible: T[] = [];
  const hidden: T[] = [];
  let stableShown = 0;

  for (const row of versionsNewestFirst) {
    const latest = row.version === latestVersion;
    const prerelease = isPrereleaseVersion(row.version);
    if (latest) {
      visible.push(row);
      if (!prerelease) stableShown += 1;
      continue;
    }
    if (prerelease || stableShown >= visibleStableLimit) {
      hidden.push(row);
      continue;
    }
    visible.push(row);
    stableShown += 1;
  }

  return { visible, hidden };
}
