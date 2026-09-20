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
    const raw = new URLSearchParams(window.location.search).get("partner");
    if (!raw) return;
    // The silence below is what hid a production misconfiguration: a `?partner=` link
    // with no router configured falls back to the direct mint, charging the tier price
    // and paying the partner nothing, with nothing visibly wrong. Falling back is still
    // right — a broken link should not be a dead card — but it should say so somewhere.
    if (!PARTNER_ROUTER_ADDRESS) {
      console.warn("[hoodfi] ?partner= ignored: no partner router configured");
      return;
    }
    if (!/^0x[0-9a-fA-F]{40}$/.test(raw)) {
      console.warn("[hoodfi] ?partner= ignored: not an address —", raw);
      return;
    }
    setPartner(raw as Address);
  }, []);

  return partner;
}
