import { env } from "cloudflare:workers";
import type { AdsEnv } from "./collect.ts";

function read(name: string): string | undefined {
  const fromWorker = (env as Record<string, string | undefined>)[name];
  return fromWorker || process.env[name];
}

export function readAdsEnv(): AdsEnv {
  return {
    CHATGPT_CAPI_API_KEY: read("CHATGPT_CAPI_API_KEY"),
    NEXT_PUBLIC_CHATGPT_PIXEL_ID: read("NEXT_PUBLIC_CHATGPT_PIXEL_ID"),
    CHATGPT_PIXEL_ID: read("CHATGPT_PIXEL_ID"),
    NEXT_PUBLIC_GA_MEASUREMENT_ID: read("NEXT_PUBLIC_GA_MEASUREMENT_ID"),
    NEXT_PUBLIC_GOOGLE_ADS_ID: read("NEXT_PUBLIC_GOOGLE_ADS_ID"),
    NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL_INSTALL: read(
      "NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL_INSTALL",
    ),
    NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL_SIGNUP: read(
      "NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL_SIGNUP",
    ),
  };
}
