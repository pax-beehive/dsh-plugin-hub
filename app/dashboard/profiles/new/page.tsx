import ProfileBuilder from "@/components/ProfileBuilder";
import { DashboardHeader } from "@/components/HubHeader";
import { getHubLocale } from "@/lib/i18n-server";
import { withAuth } from "@workos-inc/authkit-nextjs";

export const dynamic = "force-dynamic";

export default async function NewProfilePage() {
  await withAuth({ ensureSignedIn: true });
  const locale = await getHubLocale();
  return <main className="dashboard-shell">
    <DashboardHeader locale={locale} contextAction={{ href: "/dashboard", label: "← Dashboard" }} />
    <div className="dashboard-content"><ProfileBuilder locale={locale} /></div>
  </main>;
}
