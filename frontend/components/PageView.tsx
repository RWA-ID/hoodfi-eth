"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";

/**
 * Fires one page_view per route. Dropped into each page rather than the root layout
 * so the layout can stay a server component — making it a client component would
 * collapse every route onto a single OG card.
 */
export function PageView() {
  useEffect(() => {
    track("page_view");
  }, []);
  return null;
}
