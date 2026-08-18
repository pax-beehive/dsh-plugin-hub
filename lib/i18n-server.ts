import { cookies } from "next/headers";
import { HUB_LOCALE_COOKIE, parseHubLocale, type HubLocale } from "./i18n.ts";

export async function getHubLocale(): Promise<HubLocale> {
  const cookieStore = await cookies();
  return parseHubLocale(cookieStore.get(HUB_LOCALE_COOKIE)?.value);
}
