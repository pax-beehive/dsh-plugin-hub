-- Remove the retired catalog fixtures before installing reviewed community examples.
DELETE FROM profile_versions
WHERE profile_id IN (SELECT id FROM profiles WHERE slug = 'starter-web');
DELETE FROM profiles WHERE slug = 'starter-web';
DELETE FROM plugin_versions
WHERE plugin_id IN (SELECT id FROM plugins WHERE package_name = 'dshmarket');
DELETE FROM plugins WHERE package_name = 'dshmarket';

INSERT INTO plugins (
  id, owner_user_id, slug, package_name, display_name, summary, description,
  repository, homepage, license, categories_json, keywords_json, icon_url,
  screenshots_json, verified, deprecated, latest_version, dist_tags_json,
  created_at, updated_at
) VALUES
(
  'a1111111-1111-4111-8111-111111111111', NULL,
  'dsh-conversation-exporter', 'dsh-conversation-exporter',
  'Conversation Exporter',
  '将当前 DSH Web 会话导出为干净的 Markdown。',
  'Local clean-Markdown export for the current DeepSeek Harness Web conversation.',
  'liuyuelintop/dsh-conversation-exporter',
  'https://github.com/liuyuelintop/dsh-conversation-exporter#readme',
  'MIT', '["productivity","export"]',
  '["dsh","deepseek-harness","conversation-export","markdown"]',
  NULL, '[]', 0, 0, '0.2.0', '{"latest":"0.2.0"}',
  '2026-08-17T04:30:46.289Z', '2026-08-17T04:30:46.289Z'
),
(
  'b1111111-1111-4111-8111-111111111111', NULL,
  'dsh-image-gen', 'dsh-image-gen',
  'Image Gen',
  '在 DSH 对话中通过 Gemini、OpenAI 或 Seedream 生成图片。',
  'Bring ChatGPT-like image generation to DeepSeek Harness with Gemini, OpenAI, Seedream and compatible providers.',
  'shanliuling/dsh-image-gen',
  'https://github.com/shanliuling/dsh-image-gen#readme',
  'MIT', '["image-generation","multimodal"]',
  '["dsh","deepseek-harness","image-generation","gemini","openai","seedream"]',
  NULL, '[]', 0, 0, '0.1.1', '{"latest":"0.1.1"}',
  '2026-08-17T16:41:28.129Z', '2026-08-17T16:41:28.129Z'
),
(
  'c1111111-1111-4111-8111-111111111111', NULL,
  'dsh-deepseek-vision', 'dsh-deepseek-vision',
  'DeepSeek Vision',
  '通过可配置的视觉模型，让 DeepSeek 理解粘贴的图片。',
  'Vision-language gateway for DeepSeek Harness that describes image input before forwarding text to DeepSeek.',
  'siegfly/dsh-deepseek-vision',
  'https://github.com/siegfly/dsh-deepseek-vision#readme',
  'MIT', '["vision","multimodal","provider"]',
  '["dsh","deepseek-harness","vision","qwen-vl","provider"]',
  NULL, '[]', 0, 0, '0.1.5', '{"latest":"0.1.5"}',
  '2026-08-17T17:39:47.352Z', '2026-08-17T17:39:47.352Z'
)
ON CONFLICT(package_name) DO UPDATE SET
  display_name = excluded.display_name,
  summary = excluded.summary,
  description = excluded.description,
  repository = excluded.repository,
  homepage = excluded.homepage,
  license = excluded.license,
  categories_json = excluded.categories_json,
  keywords_json = excluded.keywords_json,
  icon_url = excluded.icon_url,
  screenshots_json = excluded.screenshots_json,
  verified = excluded.verified,
  latest_version = excluded.latest_version,
  dist_tags_json = excluded.dist_tags_json,
  updated_at = excluded.updated_at;

INSERT INTO plugin_versions (
  id, plugin_id, version, channel, manifest_json, source_json,
  compatibility_json, entry_ids_json, before_json, after_json,
  published_at, yanked, unpacked_size, file_count
) VALUES
(
  'a2222222-2222-4222-8222-222222222222',
  (SELECT id FROM plugins WHERE package_name = 'dsh-conversation-exporter'),
  '0.2.0', 'stable',
  '{"name":"dsh-conversation-exporter","version":"0.2.0","description":"Local clean-Markdown export for the current DeepSeek Harness Web conversation.","license":"MIT","main":"src/index.js","exports":{".":"./src/index.js","./client":"./lib/client.js","./cordis.patch.yml":"./cordis.patch.yml","./package.json":"./package.json"},"repository":{"type":"git","url":"git+https://github.com/liuyuelintop/dsh-conversation-exporter.git"},"dsh":{"bundle":{"patch":"./cordis.patch.yml"},"client":{"inject":["@deepseek-ai/dsh-client-runtime","@deepseek-ai/dsh-client-ui-conversation"],"platform":"web"}}}',
  '{"kind":"npm","packageName":"dsh-conversation-exporter","version":"0.2.0","tarballUrl":"https://registry.npmjs.org/dsh-conversation-exporter/-/dsh-conversation-exporter-0.2.0.tgz","integrity":"sha512-WUeYWrDkO2ZNRehrEUcrImrEMzIVr16QRbTAn91NrdSto/CFyAftO5NAJ/pToHxZtUKblL9j1BgS2otaVsYYZg==","installSpec":"dsh-conversation-exporter@0.2.0"}',
  '{"dsh":"*","platforms":[],"surfaces":["web"],"hmr":"restart"}',
  '[]', '[]', '[]', '2026-08-17T04:30:46.289Z', 0, 38537, 13
),
(
  'b2222222-2222-4222-8222-222222222222',
  (SELECT id FROM plugins WHERE package_name = 'dsh-image-gen'),
  '0.1.1', 'stable',
  '{"name":"dsh-image-gen","version":"0.1.1","description":"Bring ChatGPT-like image generation to DeepSeek Harness — Gemini, OpenAI, Seedream & more.","license":"MIT","main":"lib/index.js","exports":{".":{"types":"./lib/types/index.d.ts","default":"./lib/index.js"},"./client":{"types":"./lib/types/client/index.d.ts","default":"./lib/client.js"},"./package.json":"./package.json"},"repository":{"type":"git","url":"git+https://github.com/shanliuling/dsh-image-gen.git"},"dsh":{"bundle":{"patch":"./cordis.patch.yml"},"client":{"inject":["@deepseek-ai/dsh-client-connection","@deepseek-ai/dsh-api-remotes","@deepseek-ai/dsh-client-runtime","@deepseek-ai/dsh-client-ui-settings","@deepseek-ai/dsh-client-ui-settings-plugins","@deepseek-ai/dsh-client-ui-tool"],"platform":"web"}}}',
  '{"kind":"npm","packageName":"dsh-image-gen","version":"0.1.1","tarballUrl":"https://registry.npmjs.org/dsh-image-gen/-/dsh-image-gen-0.1.1.tgz","integrity":"sha512-nVKlZWnbsue4ZlP12hpi6xdB7qafytzK4LuQ0bB+2/K0PU06/LONYW5gIbs1HZ2WR7Msokn4U8M0hc5RbDNWZA==","installSpec":"dsh-image-gen@0.1.1"}',
  '{"dsh":"*","platforms":[],"surfaces":["web"],"hmr":"restart"}',
  '[]', '[]', '[]', '2026-08-17T16:41:28.129Z', 0, 83902, 17
),
(
  'c2222222-2222-4222-8222-222222222222',
  (SELECT id FROM plugins WHERE package_name = 'dsh-deepseek-vision'),
  '0.1.5', 'stable',
  '{"name":"dsh-deepseek-vision","version":"0.1.5","description":"Vision-language gateway plugin for DeepSeek Harness.","license":"MIT","main":"lib/index.js","exports":{".":{"types":"./lib/index.d.ts","default":"./lib/index.js"},"./client":{"types":"./lib/client/index.d.ts","default":"./lib/client.js"},"./cordis.patch.yml":"./cordis.patch.yml","./package.json":"./package.json"},"repository":{"type":"git","url":"git+https://github.com/siegfly/dsh-deepseek-vision.git"},"dsh":{"bundle":{"patch":"./cordis.patch.yml"},"client":{"inject":["@deepseek-ai/dsh-client-connection","@deepseek-ai/dsh-client-locale","@deepseek-ai/dsh-client-runtime","@deepseek-ai/dsh-client-ui-settings","@deepseek-ai/dsh-api-remotes"],"platform":"web"}}}',
  '{"kind":"npm","packageName":"dsh-deepseek-vision","version":"0.1.5","tarballUrl":"https://registry.npmjs.org/dsh-deepseek-vision/-/dsh-deepseek-vision-0.1.5.tgz","integrity":"sha512-w8qT1LGOPsQZf06o2qenX8WbAEQxd5gzjpMXATjBsKRPhmF9vj/LSWvN6P1vQy5HVzoXrAxSV1+zvPLClwRfzA==","installSpec":"dsh-deepseek-vision@0.1.5"}',
  '{"dsh":"*","platforms":[],"surfaces":["web"],"hmr":"restart"}',
  '[]', '[]', '[]', '2026-08-17T17:39:47.352Z', 0, 477323, 32
)
ON CONFLICT(plugin_id, version) DO UPDATE SET
  manifest_json = excluded.manifest_json,
  source_json = excluded.source_json,
  compatibility_json = excluded.compatibility_json,
  unpacked_size = excluded.unpacked_size,
  file_count = excluded.file_count;
