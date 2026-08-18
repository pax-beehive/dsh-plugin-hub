import { env } from "cloudflare:workers";

type RuntimeEmailEnv = {
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_EMAIL_API_TOKEN?: string;
  WAITLIST_FROM_EMAIL?: string;
  WAITLIST_FROM_NAME?: string;
};

type WelcomeEmailInput = {
  email: string;
  locale: "en" | "zh";
  unsubscribeUrl: string;
};

type CloudflareSendResponse = {
  success?: boolean;
  errors?: Array<{ code?: number; message?: string }>;
  result?: {
    delivered?: string[];
    permanent_bounces?: string[];
    queued?: string[];
  } | null;
};

export type WelcomeEmailResult = {
  delivery: "delivered" | "queued";
};

export async function sendWelcomeEmail(
  input: WelcomeEmailInput,
): Promise<WelcomeEmailResult> {
  const runtime = env as unknown as RuntimeEmailEnv;
  const accountId = runtime.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = runtime.CLOUDFLARE_EMAIL_API_TOKEN;
  const fromAddress = runtime.WAITLIST_FROM_EMAIL;
  const fromName = runtime.WAITLIST_FROM_NAME ?? "DeepSeek Harness Plugin Hub";

  if (!accountId || !apiToken || !fromAddress) {
    throw new Error("email_service_not_configured");
  }

  const content = buildWelcomeEmail(input.locale, input.unsubscribeUrl);
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/email/sending/send`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        to: input.email,
        from: { address: fromAddress, name: fromName },
        subject: content.subject,
        html: content.html,
        text: content.text,
        headers: {
          "List-Unsubscribe": `<${input.unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          "X-Campaign-ID": "pluginhub-waitlist-welcome",
        },
      }),
    },
  );

  const payload = (await response.json().catch(() => null)) as
    | CloudflareSendResponse
    | null;
  const result = payload?.result;

  if (!response.ok || payload?.success !== true || !result) {
    throw new Error(formatProviderError(response.status, payload));
  }

  if (result.permanent_bounces?.includes(input.email)) {
    throw new Error("email_permanent_bounce");
  }

  if (result.delivered?.includes(input.email)) {
    return { delivery: "delivered" };
  }

  if (result.queued?.includes(input.email)) {
    return { delivery: "queued" };
  }

  throw new Error("email_recipient_not_accepted");
}

function buildWelcomeEmail(locale: "en" | "zh", unsubscribeUrl: string) {
  const safeUnsubscribeUrl = escapeHtml(unsubscribeUrl);

  if (locale === "en") {
    return {
      subject: "Welcome to the DeepSeek Harness Plugin Hub waitlist",
      text: [
        "You’re on the list.",
        "",
        "Thanks for joining the DeepSeek Harness Plugin Hub waitlist. We’ll email you when the first release is ready or when there’s a meaningful update.",
        "",
        "This is an independent, unofficial community project. It is not affiliated with, authorized by, or endorsed by DeepSeek.",
        "",
        `Unsubscribe: ${unsubscribeUrl}`,
      ].join("\n"),
      html: emailShell({
        eyebrow: "YOU’RE ON THE LIST",
        heading: "Thanks for joining us.",
        body: "We’ll email you when the first DeepSeek Harness Plugin Hub release is ready or when there’s a meaningful update.",
        disclaimer:
          "This is an independent, unofficial community project. It is not affiliated with, authorized by, or endorsed by DeepSeek.",
        unsubscribeLabel: "Unsubscribe",
        unsubscribeUrl: safeUnsubscribeUrl,
      }),
    };
  }

  return {
    subject: "欢迎加入 DeepSeek Harness Plugin Hub 等候名单",
    text: [
      "你已成功加入等候名单。",
      "",
      "感谢你关注 DeepSeek Harness Plugin Hub。第一版上线或有值得关注的重要进展时，我们会通过邮件通知你。",
      "",
      "这是一个由社区独立创建和维护的非官方项目，与 DeepSeek 官方无隶属、授权或背书关系。",
      "",
      `退订：${unsubscribeUrl}`,
    ].join("\n"),
    html: emailShell({
      eyebrow: "已加入等候名单",
      heading: "感谢你的关注。",
      body: "第一版 DeepSeek Harness Plugin Hub 上线或有值得关注的重要进展时，我们会通过邮件通知你。",
      disclaimer:
        "这是一个由社区独立创建和维护的非官方项目，与 DeepSeek 官方无隶属、授权或背书关系。",
      unsubscribeLabel: "退订邮件",
      unsubscribeUrl: safeUnsubscribeUrl,
    }),
  };
}

function emailShell(input: {
  eyebrow: string;
  heading: string;
  body: string;
  disclaimer: string;
  unsubscribeLabel: string;
  unsubscribeUrl: string;
}) {
  return `<!doctype html>
<html><body style="margin:0;background:#f5f7ff;color:#0b1130;font-family:Arial,'PingFang SC','Microsoft YaHei',sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:48px 20px">
    <div style="background:#fff;border:1px solid #e7eaf4;border-radius:20px;padding:40px;box-shadow:0 12px 36px rgba(11,17,48,.08)">
      <p style="margin:0 0 18px;color:#4d6bfe;font-size:12px;font-weight:700;letter-spacing:.08em">${input.eyebrow}</p>
      <h1 style="margin:0 0 18px;font-size:30px;line-height:1.2">${input.heading}</h1>
      <p style="margin:0;color:#5a6482;font-size:16px;line-height:1.75">${input.body}</p>
      <div style="height:1px;background:#e7eaf4;margin:32px 0"></div>
      <p style="margin:0 0 18px;color:#8a93ab;font-size:12px;line-height:1.65">${input.disclaimer}</p>
      <a href="${input.unsubscribeUrl}" style="color:#5a6482;font-size:12px">${input.unsubscribeLabel}</a>
    </div>
  </div>
</body></html>`;
}

function formatProviderError(
  status: number,
  payload: CloudflareSendResponse | null,
) {
  const providerErrors = payload?.errors
    ?.map((error) => `${error.code ?? "unknown"}:${error.message ?? "unknown"}`)
    .join(",");
  return `email_provider_error_${status}${providerErrors ? `_${providerErrors}` : ""}`.slice(
    0,
    500,
  );
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
