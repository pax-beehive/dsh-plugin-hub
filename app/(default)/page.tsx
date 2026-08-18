import HomePage from "@/components/HomePage";
import { getHubLocale } from "@/lib/i18n-server";

export default async function Home() {
  return <HomePage initialLanguage={await getHubLocale()} />;
}
