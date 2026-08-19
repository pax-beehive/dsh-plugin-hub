import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import {
  hubProfileSchema,
  pluginRecordSchema,
  profileSearchResponseSchema,
  publisherMetadataSchema,
  registrySearchResponseSchema,
  screenshotSchema,
  type HubProfile,
  type PluginRecord,
  type ProfileCatalogItem,
} from "@dsh-plugin-hub/schemas";
import { z } from "zod";
import type { PluginSummary } from "./registry-service";

export type { PluginSummary };

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
  const configured = env.HUB_API_ORIGIN ?? process.env.HUB_API_ORIGIN;
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
  return fetch(`${baseUrl}${path}`, { headers: requestHeaders });
}

async function expectOk(response: Response): Promise<unknown> {
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Hub API ${response.status}: ${detail.slice(0, 300)}`);
  }
  return response.json();
}

export async function searchPackages(
  query: string,
  limit?: number,
): Promise<{ items: PluginSummary[]; nextCursor: string | null }> {
  const params = new URLSearchParams({ q: query });
  if (limit !== undefined) params.set("limit", String(limit));
  const payload = await expectOk(await hubFetch(`/api/v1/packages?${params}`));
  return registrySearchResponseSchema.parse(payload);
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
