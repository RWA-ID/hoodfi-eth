"use client";

import { useEnsResolver, useReadContract } from "wagmi";
import { mainnet } from "wagmi/chains";
import { ROBINHOOD_CHAIN_ID, robinhoodChain } from "@/lib/chains";
import {
  DONATIONS_ADDRESS,
  L1_RESOLVER_ADDRESS,
  L2_REGISTRY_ADDRESS,
  donationsAbi,
  registryAbi,
} from "@/lib/contracts";
import { expiryYear } from "@/lib/format";
import { TIER_USD } from "@/lib/labels";
import { GOAL_YEAR_LABEL } from "@/lib/site";

type Cell = { label: string; value: string; note: string; lime?: boolean };

/**
 * The six numbers under the hero.
 *
 * Every one of them is a live read except the two that are constants of the product
 * (the floor price and the chain id). An em dash stands in until a read lands, which
 * is honest: this bar is the site's claim that its figures come from the chain, so a
 * hardcoded number here would undo the argument every other section makes.
 */
export function StatBar() {
  const { data: minted } = useReadContract({
    address: L2_REGISTRY_ADDRESS,
    abi: registryAbi,
    functionName: "totalSupply",
    chainId: robinhoodChain.id,
    query: { enabled: Boolean(L2_REGISTRY_ADDRESS), refetchInterval: 30_000 },
  });

  const { data: expiry } = useReadContract({
    address: DONATIONS_ADDRESS,
    abi: donationsAbi,
    functionName: "nameExpires",
    chainId: mainnet.id,
    query: { enabled: Boolean(DONATIONS_ADDRESS), refetchInterval: 60_000 },
  });

  // "LIVE" earned rather than asserted: this asks the ENS registry on mainnet which
  // resolver hoodfi.eth actually points at, and only claims the resolver is live when
  // the answer is the contract listed in the transparency table below. A misconfigured
  // parent name reads as "—" here instead of a badge that is always green.
  const { data: resolver } = useEnsResolver({
    name: "hoodfi.eth",
    chainId: mainnet.id,
    query: { staleTime: 300_000 },
  });
  const resolverLive =
    resolver?.toLowerCase() === L1_RESOLVER_ADDRESS.toLowerCase();

  const cells: Cell[] = [
    {
      label: "mint from",
      value: `$${TIER_USD[3]}`,
      note: "one time, for life",
    },
    { label: "renewal fee", value: "$0", note: "forever, by design", lime: true },
    {
      label: "names minted",
      value: minted === undefined ? "—" : Number(minted).toLocaleString("en-US"),
      note: "read from the registry",
    },
    {
      label: "parent expiry",
      value: expiryYear(expiry)?.toString() ?? "—",
      note: `${GOAL_YEAR_LABEL} goal`,
    },
    {
      label: "chain id",
      value: String(ROBINHOOD_CHAIN_ID),
      note: "robinhood chain",
    },
    {
      label: "resolver",
      value: resolver === undefined ? "—" : resolverLive ? "LIVE" : "CHECK",
      note: "ens universal resolver",
      lime: resolverLive,
    },
  ];

  return (
    <section className="on-ink">
      <div className="shell">
        <div className="cells">
          {cells.map((cell) => (
            <div
              key={cell.label}
              className="flex-[1_1_160px] border-l border-[var(--line)] px-[22px] pb-7 pt-[26px]"
            >
              <div className="label">{cell.label}</div>
              <div
                className="stat mt-3"
                style={cell.lime ? { color: "var(--lime)" } : { color: "var(--fg)" }}
              >
                {cell.value}
              </div>
              <div className="label mt-2.5" style={{ color: "var(--faint)" }}>
                {cell.note}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
