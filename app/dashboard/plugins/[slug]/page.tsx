import EditPluginListingForm from "@/components/EditPluginListingForm";
import { DashboardHeader } from "@/components/HubHeader";
import { getOwnedPlugin } from "@/lib/hub-api";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { notFound } from "next/navigation";
import { getHubLocale } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function EditPluginListingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await withAuth({ ensureSignedIn: true });
  const locale = await getHubLocale();
  const t = locale === "en" ? {
    view: "View public page",
    intro: "npm versions continue to sync automatically. Author-provided listing details are saved here.",
  } : {
    view: "查看公开页面",
    intro: "npm 版本继续自动同步；这里保存的是作者补充信息。",
  };
  const plugin = await getOwnedPlugin((await params).slug);
  if (!plugin) notFound();

  return (
    <main className="dashboard-shell">
      <DashboardHeader
        locale={locale}
        contextAction={{ href: `/plugins/${plugin.slug}`, label: t.view }}
      />
      <div className="dashboard-content">
        <section className="dashboard-card dashboard-card-wide listing-edit-card">
          <p className="dashboard-eyebrow">CLAIMED PLUGIN</p>
          <h1>{plugin.displayName}</h1>
          <p>{plugin.packageName}: {t.intro}</p>
          <EditPluginListingForm plugin={plugin} locale={locale} />
        </section>
      </div>
    </main>
  );
}
