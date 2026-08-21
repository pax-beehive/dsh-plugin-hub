/** Cloudflare Worker entry point for the Plugin Hub site. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import {
  isCacheablePublicHtmlResponse,
  isPublicHtmlCacheRequest,
  publicPageCacheKey,
  withEdgeDiagnostics,
} from "../lib/edge-cache";
import { withSecurityHeaders } from "../lib/security-headers";

interface Env {
  ASSETS: Fetcher;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

type CacheStorageWithDefault = CacheStorage & { default?: Cache };

function defaultEdgeCache(): Cache | null {
  try {
    return (globalThis.caches as CacheStorageWithDefault | undefined)?.default ?? null;
  } catch {
    // Some compatible Worker runtimes expose CacheStorage but reject access to
    // the provider-specific default cache. Rendering must still work there.
    return null;
  }
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const startedAt = performance.now();
    const url = new URL(request.url);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      const response = await handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
      return withEdgeDiagnostics(
        withSecurityHeaders(response, request),
        "BYPASS",
        performance.now() - startedAt,
      );
    }

    const edgeCache = defaultEdgeCache();
    const shouldCache = edgeCache !== null && isPublicHtmlCacheRequest(request);
    const cacheKey = shouldCache ? publicPageCacheKey(request) : null;

    if (edgeCache && cacheKey) {
      const cached = await edgeCache.match(cacheKey);
      if (cached) {
        return withEdgeDiagnostics(
          cached,
          "HIT",
          performance.now() - startedAt,
        );
      }
    }

    const response = withSecurityHeaders(
      await handler.fetch(request, env, ctx),
      request,
    );
    const cacheable = cacheKey && isCacheablePublicHtmlResponse(response);
    if (edgeCache && cacheKey && cacheable) {
      ctx.waitUntil(
        edgeCache.put(cacheKey, response.clone()).catch((error: unknown) => {
          console.warn("edge_cache_put_failed", error);
        }),
      );
    }

    return withEdgeDiagnostics(
      response,
      cacheable ? "MISS" : "BYPASS",
      performance.now() - startedAt,
    );
  },
};

export default worker;
