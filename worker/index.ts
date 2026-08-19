/** Cloudflare Worker entry point for the Plugin Hub site. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { drizzle } from "drizzle-orm/d1";
import { D1NpmSyncStore } from "../db/npm-sync-store";
import { D1PublicationStore } from "../db/publication-store";
import * as schema from "../db/schema";
import {
  NpmSyncError,
  scheduleNpmSync,
  syncNpmPackage,
  type NpmSyncQueueMessage,
} from "../lib/npm-sync";
import { withSecurityHeaders } from "../lib/security-headers";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  NPM_SYNC_QUEUE?: Queue<NpmSyncQueueMessage>;
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

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
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
      return withSecurityHeaders(response);
    }

    return withSecurityHeaders(await handler.fetch(request, env, ctx));
  },

  async scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    if (!env.NPM_SYNC_QUEUE) {
      console.warn(JSON.stringify({ event: "npm_sync_queue_unavailable" }));
      return;
    }
    const db = drizzle(env.DB, { schema });
    ctx.waitUntil(scheduleNpmSync({
      syncStore: new D1NpmSyncStore(db),
      queue: env.NPM_SYNC_QUEUE,
    }));
  },

  async queue(
    batch: MessageBatch<NpmSyncQueueMessage>,
    env: Env,
  ): Promise<void> {
    const db = drizzle(env.DB, { schema });
    const syncStore = new D1NpmSyncStore(db);
    const publicationStore = new D1PublicationStore(db);
    for (const message of batch.messages) {
      if (message.body.type !== "sync-package") {
        message.ack();
        continue;
      }
      try {
        await syncNpmPackage({
          packageName: message.body.packageName,
          source: message.body.trigger === "discovery" ? "search" : "existing",
          syncStore,
          publicationStore,
        });
        message.ack();
      } catch (error) {
        if (error instanceof NpmSyncError && error.retryable) {
          message.retry({ delaySeconds: 60 });
        } else {
          console.error(JSON.stringify({
            event: "npm_sync_message_failed",
            packageName: message.body.packageName,
            error: error instanceof Error ? error.message : "unknown",
          }));
          message.ack();
        }
      }
    }
  },
};

export default worker;
