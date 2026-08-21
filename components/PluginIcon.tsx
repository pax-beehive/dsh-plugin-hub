"use client";

import { useState } from "react";

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

  return (
    <span className={className} aria-hidden="true">
      {iconUrl && !failed ? (
        // Plugin icons may be hosted by publishers or provided by Gravatar.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          decoding="async"
          src={iconUrl}
          onError={() => setFailed(true)}
        />
      ) : (
        fallback
      )}
    </span>
  );
}
