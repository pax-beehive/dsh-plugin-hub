declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    NPM_SYNC_QUEUE?: Queue;
    NPM_SYNC_RATE_LIMIT_SALT?: string;
    WORKOS_CLIENT_ID?: string;
    WORKOS_API_KEY?: string;
    WORKOS_COOKIE_PASSWORD?: string;
    NEXT_PUBLIC_WORKOS_REDIRECT_URI?: string;
    GITHUB_APP_ID?: string;
    GITHUB_APP_SLUG?: string;
    GITHUB_CLIENT_ID?: string;
    GITHUB_CLIENT_SECRET?: string;
    GITHUB_OAUTH_STATE_SECRET?: string;
    GITHUB_PRIVATE_KEY?: string;
    GITHUB_REDIRECT_URI?: string;
    HUB_API_ORIGIN?: string;
  }
}
