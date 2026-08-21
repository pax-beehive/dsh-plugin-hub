"use client";

import Script from "next/script";
import { useEffect } from "react";

type AdPixelsProps = {
  gaMeasurementId?: string;
  googleAdsId?: string;
  installLabel?: string;
  signupLabel?: string;
  chatgptPixelId?: string;
};

type OaiqFn = ((...args: unknown[]) => void) & { q?: unknown[] };

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    oaiq?: OaiqFn;
    __DSH_ADS?: {
      googleAdsId?: string;
      installLabel?: string;
      signupLabel?: string;
    };
  }
}

function ensureGtag(): void {
  window.dataLayer = window.dataLayer ?? [];
  if (typeof window.gtag === "function") return;
  window.gtag = function gtag() {
    // Official gtag stub pushes the Arguments object, not a rest array.
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer?.push(arguments);
  };
}

function ensureOaiq(): void {
  if (typeof window.oaiq === "function") return;
  const stub = function oaiq() {
    // eslint-disable-next-line prefer-rest-params
    stub.q?.push(arguments);
  } as OaiqFn;
  stub.q = [];
  window.oaiq = stub;
}

export default function AdPixels({
  gaMeasurementId = "",
  googleAdsId = "",
  installLabel = "",
  signupLabel = "",
  chatgptPixelId = "",
}: AdPixelsProps) {
  const gaId = gaMeasurementId.trim();
  const adsId = googleAdsId.trim();
  const pixelId = chatgptPixelId.trim();
  const googleId = gaId || adsId;

  useEffect(() => {
    window.__DSH_ADS = {
      googleAdsId: adsId || undefined,
      installLabel: installLabel.trim() || undefined,
      signupLabel: signupLabel.trim() || undefined,
    };
  }, [adsId, installLabel, signupLabel]);

  useEffect(() => {
    if (!googleId) return;
    ensureGtag();
    window.gtag?.("js", new Date());
    window.gtag?.("consent", "default", {
      ad_storage: "granted",
      analytics_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "granted",
    });
    if (gaId) window.gtag?.("config", gaId);
    if (adsId) window.gtag?.("config", adsId);
  }, [adsId, gaId, googleId]);

  useEffect(() => {
    if (!pixelId) return;
    ensureOaiq();
    window.oaiq?.("consent", true);
    window.oaiq?.("init", pixelId);
    window.oaiq?.("measure", "page_viewed", { type: "contents" });
  }, [pixelId]);

  if (!googleId && !pixelId) return null;

  return (
    <>
      {googleId ? (
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(googleId)}`}
          strategy="lazyOnload"
        />
      ) : null}
      {pixelId ? (
        <Script
          src="https://bzrcdn.openai.com/sdk/oaiq.min.js"
          strategy="lazyOnload"
        />
      ) : null}
    </>
  );
}
