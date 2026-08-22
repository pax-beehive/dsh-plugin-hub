"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type PluginResult = {
  packageName: string;
  displayName: string;
  summary: string;
  latestVersion: string;
};

type Layer = {
  packageName: string;
  selector: string;
};

type SavedDraft = {
  slug: string; name: string; description: string; dsh: string;
  runtime?: { version?: string }; bundles: Layer[]; patchYaml?: string;
  inputs?: { key: string }[]; updatedAt?: string;
};

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/;

export default function ProfileBuilder({ locale }: { locale: "en" | "zh" }) {
  const zh = locale === "zh";
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [releaseVersion, setReleaseVersion] = useState("0.1.0");
  const [dshRange, setDshRange] = useState("*");
  const [runtimeVersion, setRuntimeVersion] = useState("");
  const [patchYaml, setPatchYaml] = useState("[]\n");
  const [inputKeys, setInputKeys] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PluginResult[]>([]);
  const [layers, setLayers] = useState<Layer[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [drafts, setDrafts] = useState<SavedDraft[]>([]);

  const fetchDrafts = useCallback(async (): Promise<SavedDraft[]> => {
    const response = await fetch("/api/v1/manage/profiles", { headers: { accept: "application/json" } });
    return response.ok ? await response.json() as SavedDraft[] : [];
  }, []);

  const refreshDrafts = useCallback(async () => {
    setDrafts(await fetchDrafts());
  }, [fetchDrafts]);

  useEffect(() => {
    let active = true;
    void fetchDrafts().then((next) => { if (active) setDrafts(next); });
    return () => { active = false; };
  }, [fetchDrafts]);

  function loadDraft(saved: SavedDraft) {
    setSlug(saved.slug); setName(saved.name); setDescription(saved.description); setDshRange(saved.dsh);
    setRuntimeVersion(saved.runtime?.version ?? ""); setLayers(saved.bundles.map(({ packageName, selector }) => ({ packageName, selector })));
    setPatchYaml(saved.patchYaml ?? "[]\n"); setInputKeys((saved.inputs ?? []).map((input) => input.key).join(", "));
    setMessage(zh ? `已载入 ${saved.name}` : `Loaded ${saved.name}`);
  }

  const draft = useMemo(() => ({
    schemaVersion: 1,
    slug,
    name,
    description,
    visibility: "public",
    dsh: dshRange,
    runtime: { range: dshRange, version: runtimeVersion },
    bundles: layers.map((layer) => ({ ...layer, before: [], after: [] })),
    patch: [],
    patchYaml,
    inputs: inputKeys.split(",").map((value) => value.trim()).filter(Boolean).map((key) => ({
      key,
      label: key.replaceAll("_", " ").toLowerCase(),
      required: true,
      secret: /KEY|TOKEN|SECRET|PASSWORD/.test(key),
    })),
  }), [description, dshRange, inputKeys, layers, name, patchYaml, runtimeVersion, slug]);

  async function search() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/v1/packages?q=${encodeURIComponent(query)}&limit=8`);
      const payload = await response.json() as { items?: PluginResult[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? `HTTP ${response.status}`);
      setResults(payload.items ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally { setBusy(false); }
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= layers.length) return;
    const next = [...layers];
    [next[index], next[target]] = [next[target]!, next[index]!];
    setLayers(next);
  }

  function validate(): string | null {
    if (!name.trim()) return zh ? "请填写 Profile 名称" : "Profile name is required";
    if (!slugPattern.test(slug)) return zh ? "Slug 仅支持小写字母、数字和连字符" : "Use a lowercase kebab-case slug";
    if (!layers.length) return zh ? "至少添加一个 Plugin" : "Add at least one Plugin";
    if (!versionPattern.test(releaseVersion)) return zh ? "Release 版本需为 SemVer" : "Release version must be SemVer";
    if (!versionPattern.test(runtimeVersion)) return zh ? "请填写当前 DSH 的精确版本" : "Enter the exact current DSH version";
    for (const input of draft.inputs) {
      if (!/^[A-Z][A-Z0-9_]*$/.test(input.key)) return `${input.key}: invalid input key`;
    }
    return null;
  }

  async function save(publish: boolean) {
    const issue = validate();
    if (issue) { setMessage(issue); return; }
    setBusy(true);
    setMessage("");
    try {
      const saveResponse = await fetch(`/api/v1/manage/profiles/${encodeURIComponent(slug)}/draft`, {
        method: "PUT",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(draft),
      });
      const savePayload = await saveResponse.json() as { error?: string };
      if (!saveResponse.ok) throw new Error(savePayload.error ?? `HTTP ${saveResponse.status}`);
      if (!publish) {
        await refreshDrafts();
        setMessage(zh ? "Draft 已保存" : "Draft saved");
        return;
      }
      const publishResponse = await fetch(`/api/v1/manage/profiles/${encodeURIComponent(slug)}/releases`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ version: releaseVersion }),
      });
      const publishPayload = await publishResponse.json() as { error?: string; detail?: string };
      if (!publishResponse.ok) throw new Error(publishPayload.detail ?? publishPayload.error ?? `HTTP ${publishResponse.status}`);
      window.location.href = `/profiles/${slug}`;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally { setBusy(false); }
  }

  const publishIssue = validate();

  return (
    <div className="profile-builder">
      <section className="profile-builder-main">
        <div className="profile-builder-heading">
          <div><p className="dashboard-eyebrow">PROFILE BUILDER · V1</p><h1>{zh ? "构建可复现的 DSH Profile" : "Build a reproducible DSH Profile"}</h1></div>
          <span>{layers.length} layers</span>
        </div>
        <p className="profile-builder-intro">
          {zh ? "选择 Hub 已收录的 Plugin，确认唯一的加载顺序。发布时服务端会锁定精确版本，安装端会先验证再原子切换。" : "Choose indexed Plugins and confirm one load sequence. Publishing locks exact versions; installation validates before an atomic switch."}
        </p>
        <div className="profile-builder-grid">
          <label>{zh ? "名称" : "Name"}<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Research Stack" /></label>
          <label>Slug<input value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase())} placeholder="research-stack" /></label>
          <label>{zh ? "Release 版本" : "Release version"}<input value={releaseVersion} onChange={(event) => setReleaseVersion(event.target.value)} /></label>
          <label>DSH range<input value={dshRange} onChange={(event) => setDshRange(event.target.value)} /></label>
          <label>{zh ? "DSH 精确版本" : "Exact DSH version"}<input value={runtimeVersion} onChange={(event) => setRuntimeVersion(event.target.value)} placeholder="0.1.0-rc.7" aria-required="true" aria-invalid={runtimeVersion.length > 0 && !versionPattern.test(runtimeVersion)} /></label>
        </div>
        <label>{zh ? "说明" : "Description"}<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} /></label>

        <div className="profile-plugin-search">
          <div><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void search(); }} placeholder={zh ? "搜索已收录 Plugin" : "Search indexed Plugins"} /><button onClick={() => void search()} disabled={busy}>{zh ? "搜索" : "Search"}</button></div>
          {results.length ? <div className="profile-search-results">{results.map((plugin) => (
            <button key={plugin.packageName} disabled={layers.some((layer) => layer.packageName === plugin.packageName)} onClick={() => setLayers([...layers, { packageName: plugin.packageName, selector: "latest" }])}>
              <strong>{plugin.displayName}</strong><span>{plugin.packageName} · {plugin.latestVersion}</span><small>{plugin.summary}</small>
            </button>
          ))}</div> : null}
        </div>

        <div className="profile-builder-stack">
          <div className="profile-stack-heading"><h2>{zh ? "Layer 顺序" : "Layer sequence"}</h2><span>{zh ? "发布前由作者确认" : "author-confirmed"}</span></div>
          {layers.map((layer, index) => (
            <div className="profile-builder-layer" key={layer.packageName}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div><strong>{layer.packageName}</strong><input value={layer.selector} onChange={(event) => setLayers(layers.map((item, itemIndex) => itemIndex === index ? { ...item, selector: event.target.value } : item))} /></div>
              <div className="profile-layer-actions"><button onClick={() => move(index, -1)} disabled={index === 0}>↑</button><button onClick={() => move(index, 1)} disabled={index === layers.length - 1}>↓</button><button onClick={() => setLayers(layers.filter((_, itemIndex) => itemIndex !== index))}>×</button></div>
            </div>
          ))}
          {!layers.length ? <p className="repository-empty">{zh ? "从搜索结果添加第一个 Plugin。" : "Add the first Plugin from search results."}</p> : null}
        </div>

        <details className="profile-builder-advanced">
          <summary>{zh ? "Patch 与本地输入" : "Patch and local inputs"}</summary>
          <label>cordis.patch.yml<textarea className="profile-code-input" value={patchYaml} onChange={(event) => setPatchYaml(event.target.value)} rows={10} spellCheck={false} /></label>
          <label>{zh ? "环境变量（逗号分隔，值不会上传）" : "Environment keys (comma-separated; values never upload)"}<input value={inputKeys} onChange={(event) => setInputKeys(event.target.value.toUpperCase())} placeholder="DEEPSEEK_API_KEY" /></label>
        </details>
        {message ? <p className={message.includes("saved") || message.includes("保存") ? "dashboard-success" : "dashboard-error"}>{message}</p> : null}
        <div className="profile-builder-submit">
          <p id="profile-publish-requirement" className={publishIssue ? "profile-publish-readiness" : "profile-publish-ready"}>
            {publishIssue ? (zh ? `完成必填项后可发布：${publishIssue}` : `Complete required fields to publish: ${publishIssue}`) : (zh ? "已满足发布条件" : "Ready to publish")}
          </p>
          <button onClick={() => void save(false)} disabled={busy}>{zh ? "保存 Draft" : "Save Draft"}</button>
          <button className="dashboard-primary" onClick={() => void save(true)} disabled={busy || Boolean(publishIssue)} aria-describedby="profile-publish-requirement">{busy ? "…" : (zh ? "发布 Release" : "Publish Release")}</button>
        </div>
      </section>
      <aside className="profile-builder-aside">
        <p className="dashboard-eyebrow">V1 CONTRACT</p>
        <h2>{zh ? "发布会保证什么" : "What a release guarantees"}</h2>
        <ol><li>{zh ? "Bundle 顺序保持原样" : "Bundle order stays exact"}</li><li>{zh ? "范围解析为 exact 版本" : "Ranges resolve to exact versions"}</li><li>{zh ? "内容生成 SHA-256 标识" : "Content gets a SHA-256 identity"}</li><li>{zh ? "安装前本地组合验证" : "Local composition validation before install"}</li><li>{zh ? "失败不影响当前 Profile" : "Failures leave the current Profile intact"}</li></ol>
        <p>{zh ? "V1 仅支持 Hub 已索引、可解析的 npm/GitHub Plugin。Plugin 托管发布进入 V2。" : "V1 accepts indexed, resolvable npm/GitHub Plugins. Hub-hosted Plugin publishing stays in V2."}</p>
        {drafts.length ? <div className="profile-saved-drafts"><h3>{zh ? "你的 Drafts" : "Your drafts"}</h3>{drafts.map((saved) => <button key={saved.slug} onClick={() => loadDraft(saved)}><strong>{saved.name}</strong><span>{saved.slug} · {saved.bundles.length} layers</span></button>)}</div> : null}
      </aside>
    </div>
  );
}
