"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { handoffName } from "@/lib/handoff";

type MintQueryValue = { query: string; setQuery: (value: string) => void };

const MintQueryContext = createContext<MintQueryValue | null>(null);

/**
 * Shares the typed name between the /mint hero and the mint card, so the oversized
 * "your new wallet address" line tracks the search field character by character.
 *
 * Also picks up the handoff from another page: `?q=` from the home page, where someone
 * who types a name and connects a wallet lands here with it already filled in, and
 * `?label=` from the embeddable widget, which sends the name typed into a partner's card.
 */
export function MintQueryProvider({ children }: { children: React.ReactNode }) {
  const [query, setQuery] = useState("");

  // Read after mount, never during render — the page is prerendered into static HTML
  // and touching location during render would desync hydration.
  useEffect(() => {
    const handoff = handoffName(window.location.search);
    if (handoff) setQuery(handoff);
  }, []);

  return (
    <MintQueryContext.Provider value={{ query, setQuery }}>
      {children}
    </MintQueryContext.Provider>
  );
}

/** Null outside a provider — the home page card keeps its own local state. */
export function useMintQuery(): MintQueryValue | null {
  return useContext(MintQueryContext);
}
