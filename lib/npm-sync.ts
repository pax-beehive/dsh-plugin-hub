import type { D1NpmSyncStore, NpmDiscoverySource } from "@/db/npm-sync-store";
import type { D1PublicationStore } from "@/db/publication-store";
import { npmPackageNameSchema } from "@dsh-plugin-hub/schemas";
import {
  NpmPublicationError,
  parseNpmDistTags,
  parseNpmVersion,
} from "./npm-package-parser.ts";

const maxPackumentBytes = 8 * 1024 * 1024;
const discoveryQueries = [
  "keywords:dsh-plugin",
  "keywords:deepseek-harness",
  "deepseek harness plugin",
] as const;

export interface NpmSyncQueueMessage {
  type: "sync-package";
  packageName: string;
  trigger: "cron" | "discovery";
}

type SyncStore = Pick<
  D1NpmSyncStore,
  | "recordCandidate"
  | "markSyncing"
  | "markAccepted"
  | "markRejected"
  | "markFailed"
  | "listDue"
  | "getDiscoveryOffset"
  | "setDiscoveryOffset"
>;

type PublicationStore = Pick<
  D1PublicationStore,
  | "syncPlugin"
  | "syncProfile"
  | "reconcilePluginVersions"
  | "reconcileProfileVersions"
>;

export async function syncNpmPackage(input: {
  packageName: string;
  source: NpmDiscoverySource;
  syncStore: SyncStore;
  publicationStore: PublicationStore;
  fetcher?: typeof fetch;
  now?: number;
}) {
  const packageName = npmPackageNameSchema.parse(input.packageName);
  const now = input.now ?? Date.now();
  await input.syncStore.recordCandidate(packageName, input.source);
  await input.syncStore.markSyncing(packageName);
  try {
    const packument = await fetchPackument(packageName, input.fetcher ?? fetch);
    const rawVersions = asRecord(packument.versions);
    const times = asRecord(packument.time);
    const distTags = parseNpmDistTags(packument["dist-tags"]);
    const npmModifiedAt = parseIso(times.modified);
    const presentVersions = Object.keys(rawVersions);
    let packageKind: "plugin" | "profile" | null = null;
    let slug = "";
    let versionsAdded = 0;
    let validVersions = 0;
    let lastRejection = "not_a_dsh_bundle_or_profile";
    const latestRaw = typeof distTags.latest === "string"
      ? asRecord(rawVersions[distTags.latest])
      : {};
    const npmState = {
      distTags,
      deprecated:
        typeof latestRaw.deprecated === "string" && latestRaw.deprecated.trim() !== "",
    };

    for (const [version, rawVersion] of Object.entries(rawVersions)) {
      if (!rawVersion || typeof rawVersion !== "object") continue;
      try {
        const parsed = parseNpmVersion({
          rawPackage: rawVersion,
          packageName,
          publishedAt: parseIso(times[version]) ?? npmModifiedAt ?? new Date(now).toISOString(),
        });
        if (packageKind && parsed.kind !== packageKind) {
          lastRejection = "package_kind_changed";
          continue;
        }
        packageKind = parsed.kind;
        validVersions += 1;
        if (parsed.kind === "plugin") {
          const result = await input.publicationStore.syncPlugin(
            parsed.publication,
            npmState,
          );
          slug = result.slug;
          if (result.created) versionsAdded += 1;
        } else {
          const result = await input.publicationStore.syncProfile(parsed.publication);
          slug = result.slug;
          if (result.created) versionsAdded += 1;
        }
      } catch (error) {
        lastRejection = syncErrorCode(error);
      }
    }

    if (!packageKind || validVersions === 0) {
      await input.syncStore.markRejected(packageName, lastRejection, now);
      return {
        status: "rejected" as const,
        packageName,
        reason: lastRejection,
      };
    }
    if (packageKind === "plugin") {
      await input.publicationStore.reconcilePluginVersions(packageName, {
        presentVersions,
        ...npmState,
      });
    } else {
      await input.publicationStore.reconcileProfileVersions(packageName, {
        presentVersions,
        distTags,
      });
    }
    await input.syncStore.markAccepted({
      packageName,
      packageKind,
      npmModifiedAt,
      now,
    });
    return {
      status: "accepted" as const,
      kind: packageKind,
      packageName,
      slug,
      versionsAdded,
      versionsSeen: presentVersions.length,
      latestVersion: distTags.latest,
    };
  } catch (error) {
    const code = syncErrorCode(error);
    if (isPermanentSyncError(error)) {
      await input.syncStore.markRejected(packageName, code, now);
      return { status: "rejected" as const, packageName, reason: code };
    }
    await input.syncStore.markFailed(packageName, code, now);
    throw new NpmSyncError(code, true);
  }
}

export async function scheduleNpmSync(input: {
  syncStore: SyncStore;
  queue: Pick<Queue<NpmSyncQueueMessage>, "sendBatch">;
  fetcher?: typeof fetch;
  now?: number;
}) {
  const fetcher = input.fetcher ?? fetch;
  const now = input.now ?? Date.now();
  const queued = new Map<string, NpmSyncQueueMessage>();

  for (const query of discoveryQueries) {
    const from = await input.syncStore.getDiscoveryOffset(query);
    const response = await fetcher(
      `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=50&from=${from}`,
      {
        headers: { accept: "application/json", "user-agent": "dsh-plugin-hub/0.1" },
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!response.ok) throw new NpmSyncError("npm_search_unavailable", true);
    const body = await response.json() as {
      objects?: Array<{ package?: { name?: unknown } }>;
      total?: unknown;
    };
    const names = (body.objects ?? [])
      .map((entry) => entry.package?.name)
      .filter((name): name is string =>
        typeof name === "string" && npmPackageNameSchema.safeParse(name).success,
      );
    for (const packageName of names) {
      await input.syncStore.recordCandidate(packageName, "search");
      queued.set(packageName, { type: "sync-package", packageName, trigger: "discovery" });
    }
    const total = Number.isSafeInteger(body.total) ? Number(body.total) : 0;
    const nextOffset = names.length === 0 || from + 50 >= Math.min(total, 1_000)
      ? 0
      : from + 50;
    await input.syncStore.setDiscoveryOffset(query, nextOffset, now);
  }

  const due = await input.syncStore.listDue(now, 100);
  for (const packageName of due) {
    queued.set(packageName, { type: "sync-package", packageName, trigger: "cron" });
  }
  const messages = [...queued.values()].map((body) => ({ body }));
  for (let index = 0; index < messages.length; index += 100) {
    await input.queue.sendBatch(messages.slice(index, index + 100));
  }
  return { discovered: queued.size, queued: messages.length };
}

export class NpmSyncError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, retryable: boolean) {
    super(code);
    this.name = "NpmSyncError";
    this.code = code;
    this.retryable = retryable;
  }
}

async function fetchPackument(packageName: string, fetcher: typeof fetch) {
  const response = await fetcher(
    `https://registry.npmjs.org/${encodeURIComponent(packageName)}`,
    {
      headers: { accept: "application/json", "user-agent": "dsh-plugin-hub/0.1" },
      signal: AbortSignal.timeout(20_000),
    },
  );
  if (response.status === 404) throw new NpmPublicationError("package_not_found");
  if (!response.ok) throw new NpmPublicationError("npm_registry_unavailable");
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > maxPackumentBytes) {
    throw new NpmPublicationError("npm_document_too_large");
  }
  const text = await response.text();
  if (text.length > maxPackumentBytes) {
    throw new NpmPublicationError("npm_document_too_large");
  }
  try {
    const body = JSON.parse(text) as Record<string, unknown>;
    if (body.name !== packageName) {
      throw new NpmPublicationError("package_identity_mismatch");
    }
    return body;
  } catch (error) {
    if (error instanceof NpmPublicationError) throw error;
    throw new NpmPublicationError("invalid_npm_manifest");
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? value as Record<string, unknown>
    : {};
}

function parseIso(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? undefined : date.toISOString();
}

function syncErrorCode(error: unknown): string {
  if (error instanceof NpmPublicationError || error instanceof NpmSyncError) {
    return error.code;
  }
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string") return code;
  }
  return error instanceof Error ? error.name : "npm_sync_failed";
}

function isPermanentSyncError(error: unknown): boolean {
  return error instanceof NpmPublicationError && [
    "package_not_found",
    "npm_document_too_large",
    "invalid_npm_manifest",
    "package_identity_mismatch",
  ].includes(error.code);
}
