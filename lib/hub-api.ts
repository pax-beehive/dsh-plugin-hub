import { headers } from "next/headers";
import {
  hubProfileSchema,
  pluginRecordSchema,
  profileSearchResponseSchema,
  publisherMetadataSchema,
  screenshotSchema,
  type HubProfile,
  type PluginRecord,
  type ProfileCatalogItem,
} from "@dsh-plugin-hub/schemas";
import { z } from "zod";
import { fetchHub } from "./cloudflare-fetch";
import {
  categoryLabel,
  parseCategoryCountResponse,
  type CategoryCount,
} from "./category-count-response";
import {
  parseRegistrySearchResponse,
  parseSitemapPackageSearchResponse,
  type PluginSummary,
  type SitemapPackageSlug,
} from "./registry-search-response";

export type { CategoryCount, PluginSummary };
export { categoryLabel };

const ownedPluginSummarySchema = z
  .object({
    slug: z.string(),
    packageName: z.string(),
    displayName: z.string(),
    latestVersion: z.string(),
    repository: z.string(),
  })
  .strict();

const ownedPluginSchema = z
  .object({
    slug: z.string(),
    packageName: z.string(),
    displayName: z.string(),
    summary: z.string(),
    description: z.string(),
    homepage: z.string(),
    categories: z.array(z.string()),
    keywords: z.array(z.string()),
    screenshots: z.array(screenshotSchema),
    publisherMetadata: publisherMetadataSchema,
  })
  .strict();

const gitHubRepositorySchema = z
  .object({
    installationId: z.string(),
    accountLogin: z.string(),
    repositoryId: z.string(),
    fullName: z.string(),
    isPrivate: z.boolean(),
    defaultBranch: z.string(),
  })
  .strict();

export type OwnedPluginSummary = z.infer<typeof ownedPluginSummarySchema>;
export type OwnedPlugin = z.infer<typeof ownedPluginSchema>;
export type GitHubRepository = z.infer<typeof gitHubRepositorySchema>;

async function resolveBaseUrl(): Promise<string> {
  let configured = process.env.HUB_API_ORIGIN;
  if (!configured) {
    try {
      const worker = await import("cloudflare:workers");
      configured = worker.env.HUB_API_ORIGIN;
    } catch {
      // Plain Node rendering has no cloudflare: module; request headers remain authoritative.
    }
  }
  if (configured) return configured.replace(/\/$/, "");
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  if (!host) {
    throw new Error(
      "Hub API origin is unavailable: set HUB_API_ORIGIN or serve the request with a Host header.",
    );
  }
  const proto =
    headerList.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");
  return `${proto}://${host}`;
}

async function hubFetch(
  path: string,
  options?: { forwardCookie?: boolean },
): Promise<Response> {
  const baseUrl = await resolveBaseUrl();
  const requestHeaders: Record<string, string> = { accept: "application/json" };
  if (options?.forwardCookie) {
    const cookie = (await headers()).get("cookie");
    if (cookie) requestHeaders.cookie = cookie;
  }
  return fetchHub(`${baseUrl}${path}`, { headers: requestHeaders });
}

async function expectOk(response: Response): Promise<unknown> {
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Hub API ${response.status}: ${detail.slice(0, 300)}`);
  }
  return response.json();
}

export type PackageSearchOptions = {
  limit?: number;
  page?: number;
  cursor?: string;
  sort?: "popular" | "updated" | "name";
  category?: string;
};

function packageSearchParams(
  query: string,
  options?: PackageSearchOptions,
): URLSearchParams {
  const params = new URLSearchParams({ q: query });
  if (options?.limit !== undefined) params.set("limit", String(options.limit));
  if (options?.page !== undefined && options.page > 1)
    params.set("page", String(options.page));
  if (options?.cursor) params.set("cursor", options.cursor);
  if (options?.sort && options.sort !== "popular")
    params.set("sort", options.sort);
  if (options?.category) params.set("category", options.category);
  return params;
}

export async function searchPackages(
  query: string,
  options?: PackageSearchOptions,
): Promise<{
  items: PluginSummary[];
  nextCursor: string | null;
  total?: number;
}> {
  const payload = await expectOk(
    await hubFetch(`/api/v1/packages?${packageSearchParams(query, options)}`),
  );
  return parseRegistrySearchResponse(payload);
}

/** Catalog listing for sitemaps: slug + optional updatedAt only. Extra fields pass through. */
export async function searchSitemapPackages(
  query: string,
  options?: PackageSearchOptions,
): Promise<{
  items: SitemapPackageSlug[];
  nextCursor: string | null;
  total?: number;
}> {
  const payload = await expectOk(
    await hubFetch(`/api/v1/packages?${packageSearchParams(query, options)}`),
  );
  return parseSitemapPackageSearchResponse(payload);
}

export async function listCategories(limit = 12): Promise<CategoryCount[]> {
  try {
    const response = await hubFetch(`/api/v1/categories?limit=${limit}`);
    if (!response.ok) return [];
    return parseCategoryCountResponse(await response.json());
  } catch {
    return [];
  }
}

const sourceOnlyListingSchema = z
  .object({
    fullName: z.string(),
    description: z.string(),
    stars: z.number().int().nonnegative(),
    language: z.string().nullable(),
    license: z.string().nullable(),
    pushedAt: z.string().nullable(),
  })
  .strict();

const sourceOnlyResponseSchema = z
  .object({ items: z.array(sourceOnlyListingSchema) })
  .strict();

export type SourceOnlyListing = z.infer<typeof sourceOnlyListingSchema>;

export async function listSourceOnlyListings(input?: {
  query?: string;
  limit?: number;
}): Promise<SourceOnlyListing[]> {
  try {
    const params = new URLSearchParams();
    if (input?.query) params.set("q", input.query);
    params.set("limit", String(input?.limit ?? 12));
    const response = await hubFetch(`/api/v1/source-listings?${params}`);
    if (!response.ok) return [];
    return sourceOnlyResponseSchema.parse(await response.json()).items;
  } catch {
    return [];
  }
}

const syncStatusSchema = z
  .object({
    summary: z.array(
      z
        .object({
          status: z.string(),
          count: z.number().int().nonnegative(),
        })
        .strict(),
    ),
    recent: z.array(
      z
        .object({
          packageName: z.string(),
          status: z.string(),
          packageKind: z.string().nullable(),
          lastSyncedAt: z.string().nullable(),
          lastError: z.string().nullable(),
        })
        .strict(),
    ),
    sourceOnlyCount: z.number().int().nonnegative(),
  })
  .strict();

export type SyncStatus = z.infer<typeof syncStatusSchema>;

export async function getSyncStatus(): Promise<SyncStatus | null> {
  try {
    const response = await hubFetch("/api/v1/status");
    if (!response.ok) return null;
    return syncStatusSchema.parse(await response.json());
  } catch {
    return null;
  }
}

export async function getPackageBySlug(
  slug: string,
): Promise<PluginRecord | null> {
  const response = await hubFetch(
    `/api/v1/packages/${encodeURIComponent(slug)}`,
  );
  if (response.status === 404) return null;
  const payload = await expectOk(response);
  return pluginRecordSchema.parse(payload);
}

export async function searchProfiles(
  query: string,
  limit?: number,
): Promise<ProfileCatalogItem[]> {
  const params = new URLSearchParams({ q: query });
  if (limit !== undefined) params.set("limit", String(limit));
  const payload = await expectOk(await hubFetch(`/api/v1/profiles?${params}`));
  return profileSearchResponseSchema.parse(payload).items;
}

export async function getProfile(slug: string): Promise<HubProfile | null> {
  const response = await hubFetch(
    `/api/v1/profiles/${encodeURIComponent(slug)}`,
  );
  if (response.status === 404) return null;
  const payload = await expectOk(response);
  return hubProfileSchema.parse(payload);
}

export async function listOwnedPlugins(): Promise<OwnedPluginSummary[]> {
  const payload = await expectOk(
    await hubFetch("/api/v1/manage/plugins", { forwardCookie: true }),
  );
  return z.array(ownedPluginSummarySchema).parse(payload);
}

export async function getOwnedPlugin(
  slug: string,
): Promise<OwnedPlugin | null> {
  const response = await hubFetch(
    `/api/v1/manage/plugins/${encodeURIComponent(slug)}`,
    { forwardCookie: true },
  );
  if (response.status === 404) return null;
  const payload = await expectOk(response);
  return ownedPluginSchema.parse(payload);
}

export async function listGitHubRepositories(): Promise<GitHubRepository[]> {
  const payload = await expectOk(
    await hubFetch("/api/v1/manage/integrations/github/repositories", {
      forwardCookie: true,
    }),
  );
  return z.array(gitHubRepositorySchema).parse(payload);
}
