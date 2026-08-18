"use client";

import { useEffect } from "react";

export function ClearWaitlistState() {
  useEffect(() => {
    localStorage.removeItem("pluginhub.waitlistJoinedAt");
  }, []);

  return null;
}
