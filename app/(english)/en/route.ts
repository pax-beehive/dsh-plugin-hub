import { HUB_LOCALE_COOKIE } from "@/lib/i18n";

export function GET(request: Request) {
  return new Response(null, {
    status: 308,
    headers: {
      location: new URL("/", request.url).toString(),
      "set-cookie": `${HUB_LOCALE_COOKIE}=en; Path=/; Max-Age=31536000; SameSite=Lax`,
    },
  });
}
