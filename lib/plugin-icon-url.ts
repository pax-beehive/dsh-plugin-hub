const GRAVATAR_HOSTS = new Set([
  "gravatar.com",
  "secure.gravatar.com",
  "www.gravatar.com",
]);

export function pluginIconUrl(iconUrl?: string): string | undefined {
  if (!iconUrl) return undefined;
  try {
    const url = new URL(iconUrl);
    const match = /^\/avatar\/([a-f\d]{32})\/?$/i.exec(url.pathname);
    if (url.protocol === "https:" && GRAVATAR_HOSTS.has(url.hostname) && match) {
      return `/plugin-icons/gravatar/${match[1].toLowerCase()}`;
    }
  } catch {
    return undefined;
  }
  return iconUrl;
}
