const RECORDS: [string, string][] = [
  ["addr", "0x4f2c…9ab1"],
  ["avatar", "ipfs://bafy…"],
  ["com.twitter", "@blake"],
  ["url", "blake.xyz"],
];

/**
 * What a finished name looks like, drawn flat.
 *
 * Deliberately an illustration rather than a live read: it sits beside the ledger of
 * what a name *is*, and a card wired to real data would be empty for anyone who hasn't
 * minted yet — the section would argue for records by showing none. The abbreviated
 * address and `bafy…` avatar are unmistakably specimens, and /search/ is where a real
 * name gets rendered.
 */
export function IdentityCard() {
  return (
    <div className="panel shadow-card min-w-0 p-[22px]">
      <div className="label flex items-center justify-between">
        <span>hoodfi identity</span>
        <span>#0412</span>
      </div>

      <div className="mt-5 flex items-center gap-[18px]">
        {/* eslint-disable-next-line @next/next/no-img-element -- static export, no optimizer */}
        <img
          src="/avatars/av-blake.png"
          alt=""
          width={96}
          height={96}
          loading="lazy"
          className="block h-24 w-24 flex-none border border-[color-mix(in_srgb,var(--ink)_30%,transparent)] object-cover"
        />
        <div className="min-w-0">
          <div className="break-words text-[30px] font-extrabold leading-[1.05] tracking-[-0.035em]">
            blake<span className="text-[var(--faint)]">.hoodfi.eth</span>
          </div>
          <div className="data mt-2 text-[11.5px] text-[var(--dim)]">0x4f2c…9ab1</div>
        </div>
      </div>

      <div className="mt-[22px] border-t border-[var(--line)]">
        {RECORDS.map(([key, value]) => (
          <div
            key={key}
            className="data flex justify-between gap-4 border-b border-[var(--line-soft)] py-[11px] text-[12px]"
          >
            <span className="tracking-[0.06em] text-[var(--label)]">{key}</span>
            <span className="truncate font-medium">{value}</span>
          </div>
        ))}
      </div>

      <div className="label mt-4 flex items-center gap-2">
        <span
          className="chip-square"
          style={{ background: "var(--resolving)" }}
          aria-hidden
        />
        resolving on ethereum mainnet
      </div>
    </div>
  );
}
