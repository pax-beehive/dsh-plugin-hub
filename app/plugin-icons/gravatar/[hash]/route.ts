const gravatarHash = /^[a-f\d]{32}$/;

export async function GET(
  _request: Request,
  context: { params: Promise<{ hash: string }> },
): Promise<Response> {
  const { hash } = await context.params;
  if (!gravatarHash.test(hash)) {
    return new Response("Not found", { status: 404 });
  }

  const upstream = await fetch(
    `https://www.gravatar.com/avatar/${hash}?s=128&d=retro`,
    {
      headers: { accept: "image/avif,image/webp,image/png,image/jpeg" },
      cf: {
        cacheEverything: true,
        cacheTtlByStatus: {
          "200-299": 2_592_000,
          "404": 300,
          "500-599": 0,
        },
      },
    },
  );
  const contentType = upstream.headers.get("content-type") ?? "";
  if (!upstream.ok || !contentType.toLowerCase().startsWith("image/")) {
    return new Response("Not found", { status: 404 });
  }

  const headers = new Headers({
    "cache-control":
      "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=604800",
    "content-type": contentType,
    "cross-origin-resource-policy": "same-origin",
  });
  const etag = upstream.headers.get("etag");
  if (etag) headers.set("etag", etag);
  const cacheStatus = upstream.headers.get("cf-cache-status");
  if (cacheStatus) headers.set("x-dsh-image-origin-cache", cacheStatus);

  return new Response(upstream.body, { headers });
}
