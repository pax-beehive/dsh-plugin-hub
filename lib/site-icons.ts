import type { Metadata } from "next";

const whaleIcon = "/deepseek-whale-black.svg?v=2";

export const siteIcons: NonNullable<Metadata["icons"]> = {
  icon: [{ url: whaleIcon, type: "image/svg+xml", sizes: "any" }],
  shortcut: whaleIcon,
  apple: [{ url: "/favicon-64.png?v=2", type: "image/png", sizes: "64x64" }],
};
