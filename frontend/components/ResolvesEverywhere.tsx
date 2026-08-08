/**
 * Where a HoodFi name actually reaches.
 *
 * Built as markup rather than the single grid image it was designed from: a flat PNG
 * would be soft on retina, illegible on a phone, invisible to search, and would need
 * re-exporting every time a wallet is added.
 *
 * The rows are split deliberately. Every EVM chain shares one `addr` record, so
 * listing them together is accurate; Bitcoin and Solana need their own coinType
 * records and belong under a different heading. Collapsing the two would claim
 * support that the manage page cannot actually set.
 */

type Entry = { name: string; file: string; badge?: string };

/**
 * Clients that resolve a HoodFi name. All of them read ENS from Ethereum mainnet,
 * which is what our L1 resolver answers through CCIP-Read — support here is a
 * property of speaking ENS, not of anything we integrate with individually.
 */
const WALLETS: Entry[] = [
  { name: "MetaMask", file: "metamask" },
  { name: "Trust", file: "trust" },
  { name: "Uniswap", file: "uniswap" },
  { name: "Rainbow", file: "rainbow" },
  { name: "Safe", file: "safe" },
  { name: "Phantom", file: "phantom" },
];

/**
 * One 20-byte address record (coinType 60) is valid on every EVM chain — a wallet
 * resolves the name against mainnet whichever network it is on, then spends to that
 * address on the current chain.
 */
const EVM_CHAINS: Entry[] = [
  { name: "Ethereum", file: "ethereum" },
  { name: "Robinhood Chain", file: "robinhood", badge: "NEW" },
  { name: "Base", file: "base" },
  { name: "Arbitrum", file: "arbitrum" },
  { name: "Polygon", file: "polygon" },
  { name: "Optimism", file: "optimism" },
];

/** Non-EVM: these need their own coinType record rather than sharing addr(60). */
const NATIVE_CHAINS: Entry[] = [
  { name: "Bitcoin", file: "bitcoin" },
  { name: "Solana", file: "solana" },
];

function Tile({ name, file, badge }: Entry) {
  return (
    <div className="relative flex flex-col items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--panel-2)] px-2 py-5 text-center">
      {badge && (
        <span className="data absolute right-2 top-2 rounded border border-[var(--green)] px-1.5 py-0.5 text-[9px] leading-none text-[var(--green)]">
          {badge}
        </span>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element -- static export, no optimizer */}
      <img
        src={`/marks/${file}.png`}
        alt=""
        width={64}
        height={64}
        loading="lazy"
        className="h-10 w-10 object-contain"
      />
      <span className="data text-[11px] leading-tight text-[var(--dim)] sm:text-xs">
        {name}
      </span>
    </div>
  );
}

function Row({
  title,
  entries,
  note,
}: {
  title: string;
  entries: Entry[];
  note?: string;
}) {
  return (
    <div className="mt-8">
      <div className="eyebrow">{title}</div>
      <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
        {entries.map((e) => (
          <Tile key={e.name} {...e} />
        ))}
      </div>
      {note && (
        <p className="mt-3 max-w-[62ch] text-xs text-[var(--faint)]">{note}</p>
      )}
    </div>
  );
}

export function ResolvesEverywhere() {
  return (
    <div className="panel p-6 sm:p-8">
      <div className="eyebrow">works where you do</div>
      <h2 className="display mt-3 text-[clamp(26px,3vw,38px)]">
        One name, everywhere you already are
      </h2>
      <p className="mt-4 max-w-[62ch] text-sm leading-relaxed text-[var(--dim)]">
        Your name lives on Robinhood Chain but answers from Ethereum mainnet through
        CCIP-Read — so anything that speaks ENS can find it, with nothing to integrate
        and nothing to register twice.
      </p>

      <Row title="Wallets that resolve HoodFi names" entries={WALLETS} />

      <Row
        title="One address, every EVM chain"
        entries={EVM_CHAINS}
        note="The same address record resolves on all of them — set it once."
      />

      <Row
        title="Plus its own address on"
        entries={NATIVE_CHAINS}
        note="Bitcoin and Solana aren't EVM chains, so your name carries a separate address record for each — readable by anything that reads ENS."
      />
    </div>
  );
}
