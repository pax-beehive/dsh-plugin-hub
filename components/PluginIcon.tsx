"use client";

import { useState } from "react";
import { pluginIconUrl } from "@/lib/plugin-icon-url";

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

  return (
    <span className={className} aria-hidden="true">
      {src && !failed ? (
        // Gravatar images are routed through the same-origin edge cache.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          decoding="async"
          src={src}
          onError={() => setFailed(true)}
        />
      ) : (
        fallback
      )}
    </span>
  );
}
