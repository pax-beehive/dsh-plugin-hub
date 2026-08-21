"use client";

import { useState } from "react";
import { pluginIconUrl } from "@/lib/plugin-icon-url";

const iconSizes = {
  "plugin-icon": 42,
  "detail-icon": 68,
} as const;

export default function PluginIcon({
  className,
  displayName,
  iconUrl,
}: {
  className: "plugin-icon" | "detail-icon";
  displayName: string;
  iconUrl?: string;
}) {
  const [failed, setFailed] = useState(false);
  const fallback = displayName.trim().slice(0, 1).toUpperCase() || "P";
  const src = pluginIconUrl(iconUrl);
  const size = iconSizes[className];
  const eager = className === "detail-icon";

  return (
    <span className={className} aria-hidden="true">
      {src && !failed ? (
        // Gravatar images are routed through the same-origin edge cache.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          decoding="async"
          fetchPriority={eager ? "high" : "low"}
          height={size}
          loading={eager ? "eager" : "lazy"}
          src={src}
          width={size}
          onError={() => setFailed(true)}
        />
      ) : (
        fallback
      )}
    </span>
  );
}
