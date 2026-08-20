import { notFoundMetadata } from "@/lib/page-metadata";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = notFoundMetadata;

export default function NotFound() {
  return (
    <main className="preference-page legal-page">
      <article className="preference-card legal-card">
        <h1>Not found</h1>
        <p>This page does not exist.</p>
        <Link className="preference-back" href="/">
          Home
        </Link>
      </article>
    </main>
  );
}
