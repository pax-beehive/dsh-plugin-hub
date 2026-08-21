"use client";

import SubmitNpmPackageModal from "@/components/SubmitNpmPackageModal";
import { formatCompactCount, isHotWeeklyDownloads } from "@/lib/format-count";
import { hubCopy, localeTags, type HubLocale } from "@/lib/i18n";
import {
  RECOMMEND_TIMEOUT_MS,
  mapRecommendError,
  parseRecommendItems,
  prepareRecommendQuery,
  readRecommendErrorCode,
  type RecommendItem,
} from "@/lib/recommend";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

function writeAskParam(value: string) {
  const url = new URL(window.location.href);
  if (value) url.searchParams.set("ask", value);
  else url.searchParams.delete("ask");
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

export default function PluginRecommend({
  locale,
  ask,
}: {
  locale: HubLocale;
  ask?: string;
}) {
  const t = hubCopy[locale];
  const r = t.plugins.recommend;
  const [query, setQuery] = useState(ask ?? "");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [items, setItems] = useState<RecommendItem[] | null>(null);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const inFlight = useRef(false);

  async function recommend(raw: string, persistAsk = true) {
    if (inFlight.current) return;
    const prepared = prepareRecommendQuery(raw);
    if (!prepared.ok) {
      setQuery(raw);
      setStatus("error");
      setError(r.errors.required);
      setItems(null);
      return;
    }

    setQuery(prepared.query);
    if (persistAsk) writeAskParam(prepared.query);
    setStatus("loading");
    setError("");
    setItems(null);
    inFlight.current = true;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), RECOMMEND_TIMEOUT_MS);
    try {
      const response = await fetch(`/api/v1/packages/recommend?locale=${locale}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: prepared.query }),
        signal: controller.signal,
      });
      let payload: unknown = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      if (!response.ok) {
        setStatus("error");
        setError(
          mapRecommendError(
            {
              status: response.status,
              error: readRecommendErrorCode(payload),
              retryAfter: response.headers.get("Retry-After"),
            },
            r.errors,
          ),
        );
        return;
      }
      setItems(parseRecommendItems(payload));
      setStatus("done");
    } catch (caught) {
      const kind =
        caught instanceof DOMException && caught.name === "AbortError" ? "abort" : "network";
      setStatus("error");
      setError(mapRecommendError({ kind }, r.errors));
    } finally {
      window.clearTimeout(timer);
      inFlight.current = false;
    }
  }

  useEffect(() => {
    const initial = (ask ?? "").trim();
    if (!initial) return;
    void recommend(initial, false);
    // Auto-run once from the shareable ?ask= value supplied by the server.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void recommend(query);
  }

  function onChip(example: string) {
    setQuery(example);
    void recommend(example);
  }

  const loading = status === "loading";

  return (
    <div className="recommend">
      <form aria-busy={loading} className="recommend-form" onSubmit={onSubmit}>
        <label className="sr-only" htmlFor="plugin-recommend">
          {r.inputLabel}
        </label>
        <input
          autoComplete="off"
          id="plugin-recommend"
          onChange={(event) => setQuery(event.target.value)}
          placeholder={r.placeholder}
          type="text"
          value={query}
        />
        <button disabled={loading} type="submit">
          {r.button}
        </button>
      </form>
      <div className="recommend-chips">
        {r.examples.map((example) => (
          <button disabled={loading} key={example} onClick={() => onChip(example)} type="button">
            {example}
          </button>
        ))}
      </div>
      <button className="recommend-help" onClick={() => setModalOpen(true)} type="button">
        {r.helpLink}
      </button>
      {loading ? (
        <p aria-live="polite" className="recommend-waiting">
          {r.loading}
        </p>
      ) : null}
      {status === "error" ? (
        <p aria-live="polite" className="recommend-error">
          {error}
        </p>
      ) : null}
      {status === "done" && items && items.length === 0 ? (
        <p aria-live="polite" className="recommend-empty">
          {r.empty}
        </p>
      ) : null}
      {status === "done" && items && items.length > 0 ? (
        <section aria-label={r.resultsHeading} className="recommend-results">
          <div className="catalog-section-heading">
            <h2>{r.resultsHeading}</h2>
            <span>{t.plugins.count(items.length)}</span>
          </div>
          <div className="plugin-grid">
            {items.map((plugin) => (
              <RecommendCard key={plugin.id} locale={locale} plugin={plugin} />
            ))}
          </div>
        </section>
      ) : null}
      {modalOpen ? (
        <SubmitNpmPackageModal locale={locale} onClose={() => setModalOpen(false)} />
      ) : null}
    </div>
  );
}

function RecommendCard({
  locale,
  plugin,
}: {
  locale: HubLocale;
  plugin: RecommendItem;
}) {
  const t = hubCopy[locale];
  const updated =
    plugin.updatedAt && !Number.isNaN(new Date(plugin.updatedAt).getTime())
      ? new Date(plugin.updatedAt).toLocaleDateString(localeTags[locale])
      : "";
  return (
    <Link className="plugin-card" href={`/plugins/${plugin.slug}`}>
      <div className="plugin-card-topline">
        <span className="plugin-icon" aria-hidden="true">
          {plugin.displayName.slice(0, 1).toUpperCase()}
        </span>
        {plugin.latestVersion ? (
          <span className="plugin-version">v{plugin.latestVersion}</span>
        ) : null}
      </div>
      <h3>
        {plugin.displayName}
        {plugin.verified ? (
          <span className="verified-badge" title="Verified">
            ✓
          </span>
        ) : null}
        {plugin.claimed ? <span className="claimed-badge">{t.common.claimed}</span> : null}
      </h3>
      {plugin.packageName ? <code>{plugin.packageName}</code> : null}
      {plugin.summary ? <p>{plugin.summary}</p> : null}
      {plugin.reason ? <p className="reason">{plugin.reason}</p> : null}
      <div className="plugin-tags">
        {plugin.categories.slice(0, 3).map((category) => (
          <span key={category}>{category}</span>
        ))}
        {plugin.github ? (
          <span
            className="tag-signal"
            title={
              plugin.github.pushedAt
                ? `${t.plugins.lastPush}: ${new Date(plugin.github.pushedAt).toLocaleDateString(localeTags[locale])}`
                : undefined
            }
          >
            ★ {plugin.github.stars}
          </span>
        ) : null}
        {plugin.weeklyDownloads != null ? (
          <span className={isHotWeeklyDownloads(plugin.weeklyDownloads) ? "tag-signal tag-signal-hot" : "tag-signal"} title={t.plugins.weeklyDownloadsTitle}>{isHotWeeklyDownloads(plugin.weeklyDownloads) ? "\u{1F525} " : ""}\u2193 {formatCompactCount(plugin.weeklyDownloads)}</span>
        ) : null}
      </div>
      <div className="plugin-card-meta">
        {updated ? (
          <span>
            {t.plugins.updatedLabel} {updated}
          </span>
        ) : (
          <span />
        )}
        {plugin.license ? <span>{plugin.license}</span> : null}
      </div>
    </Link>
  );
}
