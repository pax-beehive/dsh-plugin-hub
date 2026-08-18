import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Email preferences — DeepSeek Harness Plugin Hub",
  description: "Manage DeepSeek Harness Plugin Hub email preferences.",
  robots: {
    index: false,
    follow: false,
  },
};

type UnsubscribePageProps = {
  searchParams: Promise<{ status?: string; token?: string }>;
};

export default async function UnsubscribePage({
  searchParams,
}: UnsubscribePageProps) {
  const { status, token } = await searchParams;
  const isDone = status === "done";
  const isError = status === "error";
  const isInvalid = status === "invalid" || !token;

  return (
    <main className="preference-page">
      <section className="preference-card">
        <Link className="preference-brand" href="/">
          DeepSeek Harness <strong>Plugin Hub</strong>
        </Link>

        {isDone ? (
          <>
            <p className="eyebrow">PREFERENCES UPDATED</p>
            <h1>已成功退订</h1>
            <p>你将不会再收到 Plugin Hub 的更新邮件。</p>
            <p className="preference-english">
              You’ve been unsubscribed from Plugin Hub updates.
            </p>
          </>
        ) : isError ? (
          <>
            <h1>暂时无法处理</h1>
            <p>请稍后再试。We couldn’t update your preference right now.</p>
          </>
        ) : isInvalid ? (
          <>
            <h1>链接无效</h1>
            <p>这个退订链接无效或已经过期。This unsubscribe link is invalid.</p>
          </>
        ) : (
          <>
            <p className="eyebrow">EMAIL PREFERENCES</p>
            <h1>确认退订？</h1>
            <p>确认后，你将不再收到 Plugin Hub 的更新邮件。</p>
            <p className="preference-english">
              You’ll stop receiving Plugin Hub update emails.
            </p>
            <form
              action={`/api/waitlist/unsubscribe?token=${encodeURIComponent(token)}`}
              method="post"
            >
              <button type="submit">确认退订 · Unsubscribe</button>
            </form>
          </>
        )}

        <Link className="preference-back" href="/">
          返回首页 · Back to home
        </Link>
        <p className="preference-disclaimer">
          非官方独立社区项目 · Independent, unofficial community project
        </p>
      </section>
    </main>
  );
}
