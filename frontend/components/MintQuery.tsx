"use client";

import { createContext, useContext, useEffect, useState } from "react";

type MintQueryValue = { query: string; setQuery: (value: string) => void };

const MintQueryContext = createContext<MintQueryValue | null>(null);

/**
 * Shares the typed name between the /mint hero and the mint card, so the oversized
 * "your new wallet address" line tracks the search field character by character.
 *
 * Also picks up the `?q=` handoff from the home page: someone who types a name there
 * and connects a wallet lands here with the name already filled in.
 */
export function MintQueryProvider({ children }: { children: React.ReactNode }) {
  const [query, setQuery] = useState("");

  // Read after mount, never during render — the page is prerendered into static HTML
  // and touching location during render would desync hydration.
  useEffect(() => {
    const handoff = new URLSearchParams(window.location.search).get("q");
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
