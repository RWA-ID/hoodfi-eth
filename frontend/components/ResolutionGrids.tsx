/**
 * Where a HoodFi name actually reaches.
 *
 * Built as markup rather than the grid image it was designed from: a flat PNG would be
 * soft on retina, illegible on a phone, invisible to search, and would need
 * re-exporting every time a wallet is added.
 *
 * Eight cells per group, and the count is load-bearing: at `flex: 1 1 210px` eight
 * items fill a four-, two- or one-column wrap with no ragged last row, so the bordered
 * rectangle closes at every width.
 *
 * The two groups are split deliberately. Every EVM chain shares one `addr` record, so
 * listing them together is accurate; Bitcoin and Solana need their own coinType
 * records and say so in their own note. Collapsing the two would claim support the
 * manage page cannot actually set.
 */

type Cell = { mark: string; name: string; note: string };

/**
 * Clients that resolve a HoodFi name. All of them read ENS from Ethereum mainnet,
 * which is what our L1 resolver answers through CCIP-Read — support here is a property
 * of speaking ENS, not of anything we integrate with individually.
 */
const WALLETS: Cell[] = [
  { mark: "metamask", name: "MetaMask", note: "Type the name, send" },
  { mark: "rainbow", name: "Rainbow", note: "Resolves on send" },
  { mark: "trust", name: "Trust Wallet", note: "ETH addresses resolve" },
  { mark: "safe", name: "Safe", note: "Owner and recipient lookup" },
  { mark: "phantom", name: "Phantom", note: "Solana record, ENSIP-9" },
  { mark: "uniswap", name: "Uniswap", note: "Swap straight to a name" },
  { mark: "robinhood", name: "Robinhood Wallet", note: "Native chain coinType" },
  { mark: "ethereum", name: "Any ENS app", note: "Via the Universal Resolver" },
];

const CHAINS: Cell[] = [
  { mark: "ethereum", name: "Ethereum", note: "Where resolution starts" },
  { mark: "base", name: "Base", note: "Same addr record" },
  { mark: "arbitrum", name: "Arbitrum", note: "Same addr record" },
  { mark: "optimism", name: "Optimism", note: "Same addr record" },
  { mark: "polygon", name: "Polygon", note: "Same addr record" },
  { mark: "robinhood", name: "Robinhood Chain", note: "Set at mint, id 4663" },
  { mark: "bitcoin", name: "Bitcoin", note: "Separate ENSIP-9 record" },
  { mark: "solana", name: "Solana", note: "Separate ENSIP-9 record" },
];

function Grid({ title, cells }: { title: string; cells: Cell[] }) {
  return (
    <div>
      <div className="label" style={{ letterSpacing: "0.18em" }}>
        {title}
      </div>
      <div className="mark-grid mt-3.5">
        {cells.map((cell) => (
          <div key={`${title}-${cell.name}`} className="mark-cell">
            <div
              className="mark-tile"
              style={{ backgroundImage: `url('/marks/${cell.mark}.png')` }}
              aria-hidden
            />
            <div className="min-w-0">
              <div className="text-[16.5px] font-bold tracking-[-0.02em]">{cell.name}</div>
              <div className="label mt-1.5" style={{ letterSpacing: "0.06em" }}>
                {cell.note}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ResolutionGrids() {
  return (
    <div className="mt-11 flex flex-col gap-[34px]">
      <Grid title="wallets & apps" cells={WALLETS} />
      <Grid title="chains, from one record" cells={CHAINS} />
    </div>
  );
}
