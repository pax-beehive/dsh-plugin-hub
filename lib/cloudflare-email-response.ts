export type CloudflareSendResponse = {
  success?: boolean;
  errors?: Array<{ code?: number; message?: string }>;
  result?: {
    delivered?: string[];
    message_id?: string;
    permanent_bounces?: string[];
    queued?: string[];
  } | null;
};

export type CloudflareEmailAcceptance = {
  delivery: "delivered" | "queued";
};

export function interpretCloudflareSendResponse(
  status: number,
  payload: CloudflareSendResponse | null,
  email: string,
): CloudflareEmailAcceptance {
  const result = payload?.result;
  if (status < 200 || status >= 300 || payload?.success !== true || !result) {
    throw new Error(formatProviderError(status, payload));
  }

  const matchesRecipient = (addresses: string[] | undefined) =>
    addresses?.some(
      (address) => address.trim().toLowerCase() === email.trim().toLowerCase(),
    ) ?? false;

  if (matchesRecipient(result.permanent_bounces)) {
    throw new Error("email_permanent_bounce");
  }

  if (matchesRecipient(result.delivered)) {
    return { delivery: "delivered" };
  }

  if (matchesRecipient(result.queued)) {
    return { delivery: "queued" };
  }

  // Cloudflare assigns message_id after accepting the send request. Recipient
  // status can still be empty while the accepted message enters delivery.
  if (result.message_id?.trim()) {
    return { delivery: "queued" };
  }

  throw new Error("email_recipient_not_accepted");
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
