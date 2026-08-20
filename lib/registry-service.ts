import type {
  HubProfile,
  PluginRecord,
  ProfileCatalogItem,
} from "@dsh-plugin-hub/schemas";

export type PluginSummary = Omit<PluginRecord, "versions">;
export type ProfileSummary = Omit<HubProfile, "versions">;

export interface RegistryStore {
  search(input: {
    query: string;
    limit: number;
    cursor: string | null;
  }): Promise<{ items: PluginSummary[]; nextCursor: string | null }>;
  findPackage(packageName: string): Promise<PluginRecord | null>;
  findPackageBySlug(slug: string): Promise<PluginRecord | null>;
  findProfile(slug: string): Promise<HubProfile | null>;
  listProfiles(limit: number): Promise<ProfileSummary[]>;
  searchProfiles(query: string, limit: number): Promise<ProfileCatalogItem[]>;
}

const publicCacheHeaders = {
  "cache-control": "public, max-age=60, stale-while-revalidate=300",
};

export function createPackageSearchHandler(store: RegistryStore) {
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const query = (url.searchParams.get("q") ?? "").trim().slice(0, 120);
    const cursor = url.searchParams.get("cursor");
    const requestedLimit = Number(url.searchParams.get("limit") ?? "20");
    if (!Number.isInteger(requestedLimit) || requestedLimit < 1) {
      return Response.json({ error: "invalid_limit" }, { status: 400 });
    }
    const result = await store.search({
      query,
      cursor,
      limit: Math.min(requestedLimit, 50),
    });
    return Response.json(result, { headers: publicCacheHeaders });
  };
}

export function createPackageResolveHandler(store: RegistryStore) {
  return async (request: Request): Promise<Response> => {
    const packageName = new URL(request.url).searchParams.get("name")?.trim();
    if (!packageName) {
      return Response.json({ error: "package_name_required" }, { status: 400 });
    }
    const plugin = await store.findPackage(packageName);
    if (!plugin) {
      return Response.json({ error: "package_not_found" }, { status: 404 });
    }
    return Response.json(plugin, { headers: publicCacheHeaders });
  };
}

export function createPackageBySlugHandler(store: RegistryStore) {
  return async (slug: string): Promise<Response> => {
    const plugin = await store.findPackageBySlug(slug);
    if (!plugin) {
      return Response.json({ error: "package_not_found" }, { status: 404 });
    }
    return Response.json(plugin, { headers: publicCacheHeaders });
  };
}

export function createProfileResolveHandler(store: RegistryStore) {
  return async (slug: string): Promise<Response> => {
    const profile = await store.findProfile(slug);
    if (!profile || profile.visibility === "private") {
      return Response.json({ error: "profile_not_found" }, { status: 404 });
    }
    return Response.json(profile, { headers: publicCacheHeaders });
  };
}

export function createProfileSearchHandler(store: RegistryStore) {
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const query = (url.searchParams.get("q") ?? "").trim().slice(0, 120);
    const requestedLimit = Number(url.searchParams.get("limit") ?? "20");
    if (!Number.isInteger(requestedLimit) || requestedLimit < 1) {
      return Response.json({ error: "invalid_limit" }, { status: 400 });
    }
    const items = await store.searchProfiles(
      query,
      Math.min(requestedLimit, 50),
    );
    return Response.json({ items }, { headers: publicCacheHeaders });
  };
}
