"use client";

import { captureClientFirstTouch } from "@/lib/ads-client";
import { useEffect } from "react";

export default function AttributionCapture() {
  useEffect(() => {
    captureClientFirstTouch();
  }, []);
  return null;
}
