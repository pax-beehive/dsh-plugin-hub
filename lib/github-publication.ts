import type { D1IdentityStore } from "@/db/identity-store";
import type { D1PublicationStore } from "@/db/publication-store";
import {
  compatibilitySchema,
  dshPackageManifestSchema,
  dshProfileManifestSchema,
  exactSemverSchema,
  hubListingSchema,
  hubProfileVersionSchema,
  pluginVersionSchema,
  sanitizeDshPackageManifest,
  type PluginSource,
} from "@dsh-plugin-hub/schemas";
import { createGitHubInstallationToken } from "./github-app.ts";

const githubApiVersion = "2026-03-10";

export async function publishGitHubRepository(input: {
  workosUserId: string;
  repository: string;
  appId: number;
  privateKey: string;
  identityStore: Pick<D1IdentityStore, "findGitHubRepository">;
  publicationStore: Pick<D1PublicationStore, "publishPlugin" | "publishProfile">;
  fetcher?: typeof fetch;
  now?: number;
}) {
  const access = await input.identityStore.findGitHubRepository(
    input.workosUserId,
    input.repository,
  );
  if (!access) throw new GitHubPublicationError("repository_not_authorized");
  if (access.isPrivate) throw new GitHubPublicationError("private_repository_not_supported");
  const installationId = Number(access.installationId);
  if (!Number.isSafeInteger(installationId)) {
    throw new GitHubPublicationError("invalid_installation");
  }
  const fetcher = input.fetcher ?? fetch;
  const { token } = await createGitHubInstallationToken({
    appId: input.appId,
    privateKey: input.privateKey,
    installationId,
    fetcher,
    now: input.now,
  });
  const repository = await githubJson<{
    full_name: string;
    private: boolean;
    default_branch: string;
  }>(fetcher, token, `/repos/${access.fullName}`);
  if (repository.private) throw new GitHubPublicationError("private_repository_not_supported");
  if (repository.full_name.toLowerCase() !== access.fullName.toLowerCase()) {
    throw new GitHubPublicationError("repository_identity_mismatch");
  }
  const commit = await githubJson<{ sha: string }>(
    fetcher,
    token,
    `/repos/${access.fullName}/commits/${encodeURIComponent(repository.default_branch)}`,
  );
  if (!/^[0-9a-f]{40}$/i.test(commit.sha)) {
    throw new GitHubPublicationError("invalid_repository_commit");
  }
  const rawManifest = await githubFile(
    fetcher,
    token,
    access.fullName,
    "package.json",
    repository.default_branch,
  );
  const listing = await optionalGitHubFile(
    fetcher,
    token,
    access.fullName,
    "dsh-hub.json",
    repository.default_branch,
  );
  const parsedListing = listing
    ? hubListingSchema.parse(parseJsonFile(listing))
    : hubListingSchema.parse({});
  const rawPackage = parseJsonFile(rawManifest);
  const bundle = dshPackageManifestSchema.safeParse(rawPackage);
  if (bundle.success) {
    const artifact = await resolveSource(
      fetcher,
      bundle.data.name,
      bundle.data.version,
      access.fullName,
      commit.sha,
    );
    const compatibility = parsedListing.compatibility ?? compatibilitySchema.parse({
      dsh: "*",
      surfaces: bundle.data.dsh.client?.platform
        ? [bundle.data.dsh.client.platform]
        : ["any"],
    });
    const version = pluginVersionSchema.parse({
      version: bundle.data.version,
      channel: parsedListing.channel,
      manifest: sanitizeDshPackageManifest(bundle.data),
      source: artifact.source,
      compatibility,
      entryIds: parsedListing.entryIds,
      before: parsedListing.before,
      after: parsedListing.after,
      publishedAt: new Date(input.now ?? Date.now()).toISOString(),
      yanked: false,
      unpackedSize: artifact.unpackedSize,
      fileCount: artifact.fileCount,
    });
    return input.publicationStore.publishPlugin(input.workosUserId, {
      slug: slugifyPackage(bundle.data.name),
      packageName: bundle.data.name,
      displayName: parsedListing.displayName ?? humanizePackage(bundle.data.name),
      summary: parsedListing.summary ?? bundle.data.description ?? `DSH plugin ${bundle.data.name}`,
      description: parsedListing.description ?? bundle.data.description ?? "",
      repository: access.fullName,
      homepage: parsedListing.homepage,
      license: bundle.data.license,
      categories: parsedListing.categories,
      keywords: parsedListing.keywords,
      iconUrl: parsedListing.iconUrl,
      screenshots: parsedListing.screenshots,
      version,
    });
  }

  const profile = dshProfileManifestSchema.safeParse(rawPackage);
  if (profile.success) {
    const rawRecord = rawPackage as Record<string, unknown>;
    const version = exactSemverSchema.parse(rawRecord.version);
    const publishedAt = new Date(input.now ?? Date.now()).toISOString();
    const manifest = hubProfileVersionSchema.parse({
      schemaVersion: 1,
      version,
      name: parsedListing.displayName ?? humanizePackage(profile.data.name),
      description: parsedListing.description ?? parsedListing.summary ?? "",
      dsh: "*",
      bundles: profile.data.dsh.profile.bundles.map((packageName) => ({
        packageName,
        selector: profile.data.dependencies[packageName] ?? "latest",
      })),
      patch: [],
      publishedAt,
    });
    return input.publicationStore.publishProfile(input.workosUserId, {
      slug: slugifyPackage(profile.data.name),
      packageName: profile.data.name,
      repository: access.fullName,
      owner: access.accountLogin,
      version: manifest,
    });
  }

  throw new GitHubPublicationError("not_a_dsh_bundle_or_profile");
}

export class GitHubPublicationError extends Error {
  readonly code:
    | "repository_not_authorized"
    | "private_repository_not_supported"
    | "invalid_installation"
    | "repository_identity_mismatch"
    | "invalid_repository_commit"
    | "github_api_failed"
    | "invalid_json_file"
    | "not_a_dsh_bundle_or_profile";

  constructor(
    code:
      | "repository_not_authorized"
      | "private_repository_not_supported"
      | "invalid_installation"
      | "repository_identity_mismatch"
      | "invalid_repository_commit"
      | "github_api_failed"
      | "invalid_json_file"
      | "not_a_dsh_bundle_or_profile",
  ) {
    super(code);
    this.name = "GitHubPublicationError";
    this.code = code;
  }
}

async function resolveSource(
  fetcher: typeof fetch,
  packageName: string,
  version: string,
  repository: string,
  commit: string,
): Promise<{
  source: PluginSource;
  unpackedSize?: number;
  fileCount?: number;
}> {
  const response = await fetcher(
    `https://registry.npmjs.org/${encodeURIComponent(packageName)}/${encodeURIComponent(version)}`,
    { headers: { accept: "application/json" } },
  );
  if (response.ok) {
    const body = (await response.json()) as {
      gitHead?: string;
      dist?: {
        tarball?: string;
        integrity?: string;
        unpackedSize?: number;
        fileCount?: number;
      };
    };
    if (
      body.gitHead?.toLowerCase() === commit.toLowerCase() &&
      body.dist?.tarball
    ) {
      return {
        source: {
          kind: "npm",
          packageName,
          version,
          tarballUrl: body.dist.tarball,
          integrity: body.dist.integrity,
          installSpec: `${packageName}@${version}`,
        },
        unpackedSize:
          Number.isSafeInteger(body.dist.unpackedSize) && body.dist.unpackedSize! >= 0
            ? body.dist.unpackedSize
            : undefined,
        fileCount:
          Number.isSafeInteger(body.dist.fileCount) && body.dist.fileCount! >= 0
            ? body.dist.fileCount
            : undefined,
      };
    }
  }
  return {
    source: {
      kind: "github",
      repository,
      ref: commit,
      commit,
      installSpec: `github:${repository}#${commit}`,
    },
  };
}

async function optionalGitHubFile(
  fetcher: typeof fetch,
  token: string,
  repository: string,
  path: string,
  ref: string,
): Promise<string | null> {
  try {
    return await githubFile(fetcher, token, repository, path, ref);
  } catch (error) {
    if (error instanceof GitHubPublicationError && error.message === "github_api_failed:404") {
      return null;
    }
    throw error;
  }
}

async function githubFile(
  fetcher: typeof fetch,
  token: string,
  repository: string,
  path: string,
  ref: string,
): Promise<string> {
  const response = await githubRequest(
    fetcher,
    token,
    `/repos/${repository}/contents/${path}?ref=${encodeURIComponent(ref)}`,
  );
  if (!response.ok) throw new GitHubPublicationErrorWithStatus(response.status);
  const body = (await response.json()) as { type?: string; content?: string; encoding?: string };
  if (body.type !== "file" || body.encoding !== "base64" || !body.content) {
    throw new GitHubPublicationError("invalid_json_file");
  }
  try {
    return decodeURIComponent(
      Array.from(atob(body.content.replace(/\s/g, "")), (character) =>
        `%${character.charCodeAt(0).toString(16).padStart(2, "0")}`,
      ).join(""),
    );
  } catch {
    throw new GitHubPublicationError("invalid_json_file");
  }
}

async function githubJson<T>(fetcher: typeof fetch, token: string, path: string): Promise<T> {
  const response = await githubRequest(fetcher, token, path);
  if (!response.ok) throw new GitHubPublicationErrorWithStatus(response.status);
  return response.json() as Promise<T>;
}

function githubRequest(fetcher: typeof fetch, token: string, path: string) {
  return fetcher(`https://api.github.com${path}`, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": githubApiVersion,
      "user-agent": "dsh-plugin-hub",
    },
  });
}

class GitHubPublicationErrorWithStatus extends GitHubPublicationError {
  constructor(status: number) {
    super("github_api_failed");
    this.message = `github_api_failed:${status}`;
  }
}

function slugifyPackage(packageName: string): string {
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

function parseJsonFile(contents: string): unknown {
  try {
    return JSON.parse(contents) as unknown;
  } catch {
    throw new GitHubPublicationError("invalid_json_file");
  }
}
