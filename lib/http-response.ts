type RedirectStatus = 301 | 302 | 303 | 307 | 308;

/**
 * Build a redirect whose Headers guard stays mutable in the Workers runtime.
 * This is required when an SDK or the route adapter appends cache or cookie
 * headers after the route has constructed its response.
 */
export function mutableRedirect(
  location: string | URL,
  status: RedirectStatus = 302,
): Response {
  return new Response(null, {
    status,
    headers: { location: location.toString() },
  });
}
