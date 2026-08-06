"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { track } from "@/lib/analytics";

/**
 * Sends the retired /claim URL to /mint. Done client-side because the site is a
 * static export served from IPFS — there is no server to issue a 301.
 */
export function ClaimRedirect() {
  const router = useRouter();
  useEffect(() => {
    track("page_view");
    const t = setTimeout(() => router.replace("/mint/"), 1500);
    return () => clearTimeout(t);
  }, [router]);
  return null;
}
