"use client";

import { consumeSignupEventId, trackHubEvent } from "@/lib/ads-client";
import { useEffect } from "react";

export default function DashboardSignupPixel() {
  useEffect(() => {
    const eventId = consumeSignupEventId();
    if (!eventId) return;
    void trackHubEvent("sign_in_success", { eventId, collect: false });
  }, []);
  return null;
}
