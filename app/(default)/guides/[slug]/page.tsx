import { findGuide } from "@/lib/guides";
import { notFound, permanentRedirect } from "next/navigation";

export default async function LegacyGuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = findGuide(slug);
  if (!guide) notFound();
  permanentRedirect(`/docs/${slug}`);
}
