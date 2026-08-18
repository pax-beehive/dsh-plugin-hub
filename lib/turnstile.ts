type TurnstileVerificationInput = {
  secret: string;
  token: string;
  remoteIp: string | null;
  expectedAction: string | null;
  expectedHostnames: string[];
};

type TurnstileResponse = {
  success?: boolean;
  action?: string;
  hostname?: string;
};

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export async function verifyTurnstileToken(
  input: TurnstileVerificationInput,
  fetcher: FetchLike = fetch,
) {
  if (!input.secret || !input.token) return false;

  const body = new FormData();
  body.set("secret", input.secret);
  body.set("response", input.token);
  body.set("idempotency_key", crypto.randomUUID());
  if (input.remoteIp) body.set("remoteip", input.remoteIp);

  try {
    const response = await fetcher(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body,
        signal: AbortSignal.timeout(6000),
      },
    );
    const result = (await response.json()) as TurnstileResponse;

    return Boolean(
      response.ok &&
        result.success &&
        (!input.expectedAction || result.action === input.expectedAction) &&
        result.hostname &&
        input.expectedHostnames.includes(result.hostname),
    );
  } catch {
    return false;
  }
}
