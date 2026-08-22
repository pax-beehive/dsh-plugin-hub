"use client";

import { useState } from "react";

export default function UserAvatar({
  avatarUrl,
  initials,
}: {
  avatarUrl: string | null;
  initials: string;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <span className="hub-avatar" aria-hidden="true">
      {avatarUrl && !failed ? (
        // WorkOS profile pictures can come from multiple identity providers.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          decoding="async"
          height="34"
          referrerPolicy="no-referrer"
          src={avatarUrl}
          width="34"
          onError={() => setFailed(true)}
        />
      ) : (
        <span>{initials}</span>
      )}
    </span>
  );
}
