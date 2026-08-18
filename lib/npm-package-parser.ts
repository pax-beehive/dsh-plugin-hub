import type {
  PluginPublication,
  ProfilePublication,
} from "@/db/publication-store";
import {
  compatibilitySchema,
  dshPackageManifestSchema,
  dshProfileManifestSchema,
  exactSemverSchema,
  hubListingSchema,
  hubProfileVersionSchema,
  pluginVersionSchema,
  sanitizeDshPackageManifest,
} from "@dsh-plugin-hub/schemas";

export type ParsedNpmVersion =
  | { kind: "plugin"; publication: PluginPublication; deprecated: boolean }
  | { kind: "profile"; publication: ProfilePublication; deprecated: boolean };

export function parseNpmVersion(input: {
  rawPackage: unknown;
  packageName: string;
  publishedAt: string;
  profileOwner?: string;
}): ParsedNpmVersion {
  if (!input.rawPackage || typeof input.rawPackage !== "object") {
    throw new NpmPublicationError("invalid_npm_manifest");
  }
  const raw = input.rawPackage as Record<string, unknown>;
  if (raw.name !== input.packageName) {
    throw new NpmPublicationError("package_identity_mismatch");
  }
  const rawDsh = raw.dsh && typeof raw.dsh === "object"
    ? raw.dsh as Record<string, unknown>
    : {};
  const listing = hubListingSchema.parse(raw.dshHub ?? rawDsh.hub ?? {});
  const deprecated = typeof raw.deprecated === "string" && raw.deprecated.trim() !== "";

  const bundle = dshPackageManifestSchema.safeParse(input.rawPackage);
  if (bundle.success) {
    const distribution = parseDistribution(raw.dist);
    const repository = parseGitHubRepository(bundle.data.repository);
    if (!repository) throw new NpmPublicationError("invalid_repository");
    const compatibility = listing.compatibility ?? compatibilitySchema.parse({
      dsh: "*",
      surfaces: bundle.data.dsh.client?.platform
        ? [bundle.data.dsh.client.platform]
        : ["any"],
    });
    const version = pluginVersionSchema.parse({
      version: bundle.data.version,
      channel: listing.channel,
      manifest: sanitizeDshPackageManifest(bundle.data),
      source: {
        kind: "npm",
        packageName: input.packageName,
        version: bundle.data.version,
        tarballUrl: distribution.tarball,
        integrity: distribution.integrity,
        installSpec: `${input.packageName}@${bundle.data.version}`,
      },
      compatibility,
      entryIds: listing.entryIds,
      before: listing.before,
      after: listing.after,
      publishedAt: input.publishedAt,
      yanked: false,
      unpackedSize: distribution.unpackedSize,
      fileCount: distribution.fileCount,
    });
    return {
      kind: "plugin",
      deprecated,
      publication: {
        slug: slugifyPackage(input.packageName),
        packageName: input.packageName,
        displayName: listing.displayName ?? humanizePackage(input.packageName),
        summary: listing.summary ?? bundle.data.description ?? `DSH plugin ${input.packageName}`,
        description: listing.description ?? bundle.data.description ?? "",
        repository,
        homepage: listing.homepage ?? parseHomepage(raw.homepage),
        license: bundle.data.license,
        categories: listing.categories,
        keywords: listing.keywords.length ? listing.keywords : parseKeywords(raw.keywords),
        iconUrl: listing.iconUrl,
        screenshots: listing.screenshots,
        version,
      },
    };
  }

  const profile = dshProfileManifestSchema.safeParse(input.rawPackage);
  if (profile.success) {
    parseDistribution(raw.dist);
    const version = exactSemverSchema.parse(raw.version);
    const repository = parseGitHubRepository(raw.repository) ?? undefined;
    const manifest = hubProfileVersionSchema.parse({
      schemaVersion: 1,
      version,
      name: listing.displayName ?? humanizePackage(profile.data.name),
      description: listing.description ?? listing.summary ?? "",
      dsh: listing.compatibility?.dsh ?? "*",
      bundles: profile.data.dsh.profile.bundles.map((bundleName) => ({
        packageName: bundleName,
        selector: profile.data.dependencies[bundleName] ?? "latest",
      })),
      patch: [],
      publishedAt: input.publishedAt,
    });
    return {
      kind: "profile",
      deprecated,
      publication: {
        slug: slugifyPackage(profile.data.name),
        packageName: profile.data.name,
        repository,
        owner: input.profileOwner?.trim() || "npm",
        version: manifest,
      },
    };
  }

  throw new NpmPublicationError("not_a_dsh_bundle_or_profile");
}

export function parseNpmDistTags(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  const result: Record<string, string> = {};
  for (const [tag, version] of Object.entries(value)) {
    if (typeof version !== "string" || !exactSemverSchema.safeParse(version).success) continue;
    if (!/^[A-Za-z0-9._-]{1,80}$/.test(tag)) continue;
    result[tag] = version;
  }
  return result;
}

export class NpmPublicationError extends Error {
  readonly code:
    | "invalid_version_selector"
    | "package_not_found"
    | "npm_registry_unavailable"
    | "npm_document_too_large"
    | "invalid_npm_manifest"
    | "package_identity_mismatch"
    | "invalid_repository"
    | "invalid_distribution"
    | "not_a_dsh_bundle_or_profile";

  constructor(code: NpmPublicationError["code"]) {
    super(code);
    this.name = "NpmPublicationError";
    this.code = code;
  }
}

function parseDistribution(value: unknown): {
  tarball: string;
  integrity?: string;
  unpackedSize?: number;
  fileCount?: number;
} {
  if (!value || typeof value !== "object") {
    throw new NpmPublicationError("invalid_distribution");
  }
  const distribution = value as Record<string, unknown>;
  if (
    typeof distribution.tarball !== "string" ||
    !distribution.tarball.startsWith("https://registry.npmjs.org/")
  ) {
    throw new NpmPublicationError("invalid_distribution");
  }
  return {
    tarball: distribution.tarball,
    integrity: typeof distribution.integrity === "string"
      ? distribution.integrity
      : undefined,
    unpackedSize: asNonNegativeInteger(distribution.unpackedSize),
    fileCount: asNonNegativeInteger(distribution.fileCount),
  };
}

function asNonNegativeInteger(value: unknown): number | undefined {
  return Number.isSafeInteger(value) && (value as number) >= 0
    ? value as number
    : undefined;
}

export function parseGitHubRepository(value: unknown): string | null {
  const raw = typeof value === "string"
    ? value
    : value && typeof value === "object" && typeof (value as Record<string, unknown>).url === "string"
      ? (value as Record<string, string>).url
      : null;
  if (!raw) return null;
  const normalized = raw
    .replace(/^github:/i, "https://github.com/")
    .replace(/^git\+/, "")
    .replace(/^git:\/\//, "https://")
    .replace(/^git@github\.com:/i, "https://github.com/")
    .replace(/\.git(?:#.*)?$/, "");
  try {
    const url = new URL(normalized);
    if (url.hostname.toLowerCase() !== "github.com") return null;
    const parts = url.pathname.split("/").filter(Boolean);
    return parts.length === 2 && parts.every((part) => /^[A-Za-z0-9_.-]+$/.test(part))
      ? `${parts[0]}/${parts[1]}`
      : null;
  } catch {
    return null;
  }
}

export function slugifyPackage(packageName: string): string {
  return packageName
    .replace(/^@/, "")
    .replace(/[/. _]+/g, "-")
    .replace(/[^a-zA-Z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function humanizePackage(packageName: string): string {
  const part = packageName.split("/").at(-1) ?? packageName;
  return part
    .replace(/^dsh[-_.]?/i, "")
    .split(/[-_.]+/)
    .filter(Boolean)
    .map((word) => word.slice(0, 1).toUpperCase() + word.slice(1))
    .join(" ") || packageName;
}

function parseHomepage(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function parseKeywords(value: unknown): string[] {
  const keywords = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[ ,]+/)
      : [];
  return keywords
    .filter((keyword): keyword is string => typeof keyword === "string")
    .map((keyword) => keyword.trim().slice(0, 60))
    .filter(Boolean)
    .slice(0, 30);
}
