import assert from "node:assert/strict";
import test from "node:test";
import { parseCategoryCountResponse } from "../lib/category-count-response.ts";

const livePayload = {
  items: [
    {
      name: "agents-orchestration",
      displayName: "Agents & Orchestration",
      displayNameZh: "智能体与编排",
      description: "Agent frameworks, multi-agent workflows, and orchestration.",
      descriptionZh: "智能体框架、多智能体工作流与编排。",
      count: 0,
    },
    {
      name: "memory-context",
      displayName: "Memory & Context",
      displayNameZh: "记忆与上下文",
      description: "Memory stores and context management.",
      descriptionZh: "记忆存储与上下文管理。",
      count: 0,
    },
    {
      name: "developer-tools",
      displayName: "Developer Tools",
      displayNameZh: "开发者工具",
      description: "Tooling for building and debugging plugins.",
      descriptionZh: "构建与调试插件的工具。",
      count: 0,
    },
    {
      name: "ui-customization",
      displayName: "UI Customization",
      displayNameZh: "界面定制",
      description: "UI skins, themes, and presentation.",
      descriptionZh: "界面皮肤、主题与展示。",
      count: 0,
    },
    {
      name: "integrations-communication",
      displayName: "Integrations & Communication",
      displayNameZh: "集成与通信",
      description: "Third-party integrations and messaging.",
      descriptionZh: "第三方集成与消息通信。",
      count: 0,
    },
    {
      name: "vision-media",
      displayName: "Vision & Media",
      displayNameZh: "视觉与媒体",
      description: "Images, video, and multimodal media.",
      descriptionZh: "图像、视频与多模态媒体。",
      count: 0,
    },
    {
      name: "search-research",
      displayName: "Search & Research",
      displayNameZh: "搜索与研究",
      description: "Search, retrieval, and research tools.",
      descriptionZh: "搜索、检索与研究工具。",
      count: 0,
    },
    {
      name: "security-access",
      displayName: "Security & Access",
      displayNameZh: "安全与访问",
      description: "Auth, secrets, and access control.",
      descriptionZh: "认证、密钥与访问控制。",
      count: 0,
    },
    {
      name: "models-usage",
      displayName: "Models & Usage",
      displayNameZh: "模型与用量",
      description: "Model routing and usage metering.",
      descriptionZh: "模型路由与用量计量。",
      count: 0,
    },
    {
      name: "productivity-workflow",
      displayName: "Productivity & Workflow",
      displayNameZh: "效率与工作流",
      description: "Everyday productivity and workflow helpers.",
      descriptionZh: "日常效率与工作流助手。",
      count: 0,
    },
  ],
};

test("listCategories schema accepts live extra fields and count 0", () => {
  const items = parseCategoryCountResponse(livePayload);
  assert.equal(items.length, 10);
  assert.equal(items[0]?.name, "agents-orchestration");
  assert.equal(items[0]?.displayName, "Agents & Orchestration");
  assert.equal(items[0]?.displayNameZh, "智能体与编排");
  assert.equal(items[0]?.description?.includes("orchestration"), true);
  assert.equal(items[0]?.count, 0);
  assert.deepEqual(
    items.map((item) => item.name),
    [
      "agents-orchestration",
      "memory-context",
      "developer-tools",
      "ui-customization",
      "integrations-communication",
      "vision-media",
      "search-research",
      "security-access",
      "models-usage",
      "productivity-workflow",
    ],
  );
});

test("name and count remain required", () => {
  assert.throws(() => parseCategoryCountResponse({ items: [{ name: "x" }] }));
  assert.throws(() => parseCategoryCountResponse({ items: [{ count: 1 }] }));
});
