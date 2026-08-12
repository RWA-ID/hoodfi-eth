/**
 * The name band under the stat bar.
 *
 * The list is rendered twice and the row is translated by exactly -50%, so the second
 * copy is under the cursor at the moment the animation restarts and the loop has no
 * seam. Stopped entirely under `prefers-reduced-motion` (see globals.css) — a
 * continuously moving band is the kind of thing that setting exists for.
 */
const NAMES = [
  "blake",
  "gm",
  "vault",
  "degen",
  "paxos",
  "hoodie",
  "kite",
  "alpha",
  "onchain",
  "mint",
  "ledger",
  "north",
];

export function Ticker() {
  return (
    <div className="on-ink ticker" aria-hidden>
      <div className="ticker-row data text-[12px] uppercase tracking-[0.14em] text-[var(--faint)]">
        {[...NAMES, ...NAMES].map((name, i) => (
          <span key={`${name}-${i}`} className="whitespace-nowrap px-[22px]">
            {name}.hoodfi.eth
          </span>
        ))}
      </div>
    </div>
  );
}
