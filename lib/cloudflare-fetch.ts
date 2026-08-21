const PUBLIC_HUB_READS = [
  /^\/api\/v1\/categories$/,
  /^\/api\/v1\/packages(?:\/[^/]+)?$/,
  /^\/api\/v1\/profiles(?:\/[^/]+)?$/,
  /^\/api\/v1\/source-listings$/,
];

export function isPublicHubRead(method: string, target: string | URL): boolean {
  if (method.toUpperCase() !== "GET") return false;
  const pathname = new URL(target).pathname;
  return PUBLIC_HUB_READS.some((pattern) => pattern.test(pathname));
}

export async function fetchHub(
  target: string | URL,
  init: RequestInit = {},
): Promise<Response> {
  const method = init.method ?? "GET";
  const cacheable = isPublicHubRead(method, target);
  const startedAt = performance.now();
  const options: RequestInit = cacheable
    ? {
        ...init,
        cf: {
          cacheEverything: true,
          cacheTtlByStatus: {
            "200-299": 300,
            "404": 30,
            "500-599": 0,
          },
        },
      }
    : init;
  const response = await fetch(target, options);
  const durationMs = performance.now() - startedAt;

  console.info(
    JSON.stringify({
      event: "hub_fetch",
      path: new URL(target).pathname,
      status: response.status,
      durationMs: Number(durationMs.toFixed(1)),
      cacheable,
      cacheStatus: response.headers.get("cf-cache-status") ?? "unknown",
    }),
  );
  return response;
}
