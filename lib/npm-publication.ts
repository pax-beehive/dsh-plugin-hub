import type { D1PublicationStore } from "@/db/publication-store";
import { npmPackageNameSchema } from "@dsh-plugin-hub/schemas";
import {
  NpmPublicationError,
  parseNpmVersion,
} from "./npm-package-parser.ts";

export { NpmPublicationError } from "./npm-package-parser.ts";

export async function publishNpmPackage(input: {
  workosUserId: string;
  packageName: string;
  version?: string;
  publisherName?: string;
  publicationStore: Pick<D1PublicationStore, "publishPlugin" | "publishProfile">;
  fetcher?: typeof fetch;
  now?: number;
}) {
  const packageName = npmPackageNameSchema.parse(input.packageName);
  const selector = input.version?.trim() || "latest";
  if (!/^(?:latest|next|beta|canary|\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/.test(selector)) {
    throw new NpmPublicationError("invalid_version_selector");
  }
  const fetcher = input.fetcher ?? fetch;
  const response = await fetcher(
    `https://registry.npmjs.org/${encodeURIComponent(packageName)}/${encodeURIComponent(selector)}`,
    {
      headers: {
        accept: "application/json",
        "user-agent": "dsh-plugin-hub/0.1",
      },
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (response.status === 404) throw new NpmPublicationError("package_not_found");
  if (!response.ok) throw new NpmPublicationError("npm_registry_unavailable");

  const parsed = parseNpmVersion({
    rawPackage: await response.json(),
    packageName,
    publishedAt: new Date(input.now ?? Date.now()).toISOString(),
    profileOwner: input.publisherName,
  });
  if (parsed.kind === "plugin") {
    return input.publicationStore.publishPlugin(
      input.workosUserId,
      parsed.publication,
    );
  }
  return input.publicationStore.publishProfile(
    input.workosUserId,
    parsed.publication,
  );
}
