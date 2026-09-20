"use client";

import { useEffect, useState } from "react";
import type { Address } from "viem";
import { PARTNER_ROUTER_ADDRESS } from "@/lib/contracts";

/**
 * The `?partner=0x…` handoff from an embedded widget.
 *
 * Read after mount and never during render, the same way MintQueryProvider picks up `?q=`:
 * the page is prerendered into static HTML, and touching `location` during render desyncs
 * hydration. The cost is that the first paint is always the direct-mint card and the
 * partner price arrives a tick later — which is the right trade, because the alternative
 * is a hydration mismatch on the one card that takes money.
 *
 * Returns undefined when there is no partner, when the address is malformed, or when no
 * router is configured. Every one of those means "mint directly", so a broken link
 * degrades to the normal flow rather than to a dead card.
 */
export function usePartner(): Address | undefined {
  const [partner, setPartner] = useState<Address | undefined>(undefined);

  useEffect(() => {
    if (!PARTNER_ROUTER_ADDRESS) return;
    const raw = new URLSearchParams(window.location.search).get("partner");
    if (raw && /^0x[0-9a-fA-F]{40}$/.test(raw)) setPartner(raw as Address);
  }, []);

  return partner;
}
