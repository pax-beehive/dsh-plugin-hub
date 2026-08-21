import HubHeader from "@/components/HubHeader";
import { getSyncStatus } from "@/lib/hub-api";
import { hubCopy, localeTags } from "@/lib/i18n";
import { getHubLocale } from "@/lib/i18n-server";
import { pageMetadata } from "@/lib/page-metadata";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    path: "/status",
    title: "Status — DSH Plugin Hub",
    description: "Public status of the DSH Plugin Hub ingestion pipeline.",
  });
}

const stateOrder = ["accepted", "syncing", "pending", "error", "rejected"];

export default async function StatusPage() {
  const locale = await getHubLocale();
  const t = hubCopy[locale];
  const status = await getSyncStatus();
  const hasPipeline = Boolean(
    status &&
      (status.recent.length > 0 || status.summary.some((entry) => entry.count > 0)),
  );
  const intro = hasPipeline ? t.status.intro : t.status.introLive;

  // The Go backend may not serve /api/v1/status yet — render a placeholder
  // instead of crashing so the URL stays valid and lights up automatically
  // once the endpoint ships.
  if (!status) {
    return (
      <main className="hub-shell">
        <HubHeader locale={locale} />
        <section className="catalog-hero compact">
          <p className="catalog-eyebrow">STATUS</p>
          <h1>{t.status.title}</h1>
          <p>{intro}</p>
        </section>
        <section className="status-section">
          <div className="catalog-empty">
            <h2>{t.status.empty}</h2>
          </div>
        </section>
      </main>
    );
  }

  const { summary, recent, sourceOnlyCount } = status;
  const ordered = [...summary].sort(
    (a, b) => stateOrder.indexOf(a.status) - stateOrder.indexOf(b.status),
  );
  const stateLabel = (s: string) =>
    (t.status.states as Record<string, string>)[s] ?? s;
  const kindLabel = (kind: string | null) =>
    kind ? (t.status.kinds as Record<string, string>)[kind] ?? kind : "—";

  return (
    <main className="hub-shell">
      <HubHeader locale={locale} />
      <section className="catalog-hero compact">
        <p className="catalog-eyebrow">STATUS</p>
        <h1>{t.status.title}</h1>
        <p>{intro}</p>
      </section>

      <section className="status-section" aria-label={t.status.pipeline}>
        <div className="status-stat-grid">
          {ordered.map((entry) => (
            <div className={`status-stat status-${entry.status}`} key={entry.status}>
              <span>{stateLabel(entry.status)}</span>
              <strong>{entry.count}</strong>
            </div>
          ))}
          <div className="status-stat status-source">
            <span>{t.status.githubDiscovery}</span>
            <strong>{sourceOnlyCount}</strong>
          </div>
        </div>
      </section>

      <section className="status-section" aria-label={t.status.recent}>
        <div className="catalog-section-heading">
          <h2>{t.status.recent}</h2>
        </div>
        {recent.length ? (
          <div className="status-table-wrap">
            <table className="status-table">
              <thead>
                <tr>
                  <th>{t.status.packageName}</th>
                  <th>{t.status.state}</th>
                  <th>{t.status.kind}</th>
                  <th>{t.status.syncedAt}</th>
                  <th>{t.status.lastError}</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((row) => (
                  <tr key={row.packageName}>
                    <td><code>{row.packageName}</code></td>
                    <td>
                      <span className={`status-pill status-${row.status}`}>
                        {stateLabel(row.status)}
                      </span>
                    </td>
                    <td>{kindLabel(row.packageKind)}</td>
                    <td>
                      {row.lastSyncedAt
                        ? new Date(row.lastSyncedAt).toLocaleString(localeTags[locale])
                        : "—"}
                    </td>
                    <td className="status-error-cell">{row.lastError ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="catalog-empty">
            <h2>{t.status.empty}</h2>
          </div>
        )}
      </section>
    </main>
  );
}
