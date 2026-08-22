import {
  searchPackages,
  type CategoryCount,
  type PackageSearchOptions,
  type PluginSummary,
} from "./hub-api.ts";
import type { HubLocale } from "./i18n.ts";

type CategoryPreviewSearch = (
  query: string,
  options?: Pick<PackageSearchOptions, "locale" | "limit" | "category">,
) => Promise<{ items: PluginSummary[] }>;

export async function loadCategoryPreviews(
  categories: CategoryCount[],
  locale: HubLocale,
  limit: number,
  search: CategoryPreviewSearch = searchPackages,
): Promise<Map<string, PluginSummary[]>> {
  const previews = await Promise.all(
    categories.map(async (entry) => {
      try {
        const result = await search("", {
          category: entry.name,
          limit,
          locale,
        });
        return [entry.name, result.items.slice(0, limit)] as const;
      } catch {
        return [entry.name, [] as PluginSummary[]] as const;
      }
    }),
  );

  return new Map(previews);
}
