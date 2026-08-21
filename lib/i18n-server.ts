import { cookies, headers } from "next/headers";
import { HUB_LOCALE_COOKIE, resolveHubLocale, type HubLocale } from "./i18n.ts";

export async function getHubLocale(): Promise<HubLocale> {
  const cookieStore = await cookies();
  const headerStore = await headers();
  return resolveHubLocale(
    cookieStore.get(HUB_LOCALE_COOKIE)?.value,
    headerStore.get("accept-language"),
  );
}
