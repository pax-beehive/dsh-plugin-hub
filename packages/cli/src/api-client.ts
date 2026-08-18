import {
  hubProfileSchema,
  pluginRecordSchema,
  registrySearchResponseSchema,
  profileSearchResponseSchema,
  type HubProfile,
  type PluginRecord,
} from "@dsh-plugin-hub/schemas";

export class HubApiClient {
  readonly baseUrl: string;

  constructor(baseUrl = "https://dshpluginhub.ai/api/v1") {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  private async get(path: string): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: { accept: "application/json", "user-agent": "dsh-hub-cli/0.1" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Hub API ${response.status}: ${detail.slice(0, 300)}`);
    }
    return response.json();
  }

  async search(query: string) {
    const payload = await this.get(`/packages?q=${encodeURIComponent(query)}`);
    return registrySearchResponseSchema.parse(payload);
  }

  async package(packageName: string): Promise<PluginRecord> {
    const payload = await this.get(`/packages/resolve?name=${encodeURIComponent(packageName)}`);
    return pluginRecordSchema.parse(payload);
  }

  async profile(slug: string): Promise<HubProfile> {
    const payload = await this.get(`/profiles/${encodeURIComponent(slug)}`);
    return hubProfileSchema.parse(payload);
  }

  async profiles(query: string) {
    const payload = await this.get(`/profiles?q=${encodeURIComponent(query)}`);
    return profileSearchResponseSchema.parse(payload);
  }
}
