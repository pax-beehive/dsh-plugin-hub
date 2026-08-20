"use client";

import Script from "next/script";
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

type TurnstileApi = {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      theme: "light";
      size: "flexible";
      language: "en" | "zh";
      callback(token: string): void;
      "expired-callback"(): void;
      "error-callback"(): void;
    },
  ): string;
  reset(widgetId: string): void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export type TurnstileWidgetHandle = {
  reset(): void;
};

type TurnstileWidgetProps = {
  siteKey: string;
  language: "en" | "zh";
  action?: string;
  onTokenChange(token: string): void;
};

export const TurnstileWidget = forwardRef<
  TurnstileWidgetHandle,
  TurnstileWidgetProps
>(function TurnstileWidget(
  { siteKey, language, action = "waitlist", onTokenChange },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const renderWidget = useCallback(() => {
    if (!containerRef.current || !window.turnstile || widgetIdRef.current) return;

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      action,
      theme: "light",
      size: "flexible",
      language,
      callback: onTokenChange,
      "expired-callback": () => onTokenChange(""),
      "error-callback": () => {
        onTokenChange("");
        setLoadFailed(true);
      },
    });
  }, [action, language, onTokenChange, siteKey]);

  useImperativeHandle(ref, () => ({
    reset() {
      onTokenChange("");
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.reset(widgetIdRef.current);
      }
    },
  }));

  return (
    <div className="turnstile-shell">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={renderWidget}
        onError={() => setLoadFailed(true)}
      />
      <div
        ref={containerRef}
        className="turnstile-widget"
        data-language={language}
      />
      {loadFailed ? (
        <span className="turnstile-error" role="status">
          {language === "zh"
            ? "安全验证加载失败，请刷新后重试。"
            : "Security check failed to load. Please refresh and retry."}
        </span>
      ) : null}
    </div>
  );
});
