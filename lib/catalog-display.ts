export function descriptionsAreDuplicate(
  description: string | null | undefined,
  summary: string | null | undefined,
): boolean {
  return (description ?? "").trim() === (summary ?? "").trim();
}

export function sortByWeeklyDownloads<T extends { weeklyDownloads: number }>(
  items: T[],
): T[] {
  return items
    .slice()
    .sort((left, right) => right.weeklyDownloads - left.weeklyDownloads);
}

export function duplicateDisplayNames(
  items: Array<{ displayName: string }>,
): Set<string> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = item.displayName.trim().toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return new Set(
    [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([name]) => name),
  );
}

export function packageScopeHint(packageName: string, repository?: string): string {
  if (packageName.startsWith("@")) {
    const scope = packageName.slice(1).split("/")[0];
    if (scope) return `@${scope}`;
  }
  const owner = repository?.split("/")[0];
  return owner || packageName;
}

export function altPackageHint(
  items: Array<{ displayName: string; packageName: string; repository?: string }>,
  plugin: { displayName: string; packageName: string; repository?: string },
): string | null {
  const key = plugin.displayName.trim().toLowerCase();
  const duplicates = items.filter(
    (item) => item.displayName.trim().toLowerCase() === key,
  );
  if (duplicates.length < 2) return null;
  const first = duplicates[0];
  if (first && first.packageName === plugin.packageName) return null;
  return `alt · ${packageScopeHint(plugin.packageName, plugin.repository)}`;
}
