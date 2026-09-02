import Image from "next/image";

/**
 * HoodFi Names × Robinhood Wallet — the co-brand coda, between the closing CTA
 * and the footer.
 *
 * Kept on paper rather than ink for one hard reason: Apple ships a black badge
 * for light grounds and a white one for dark, and only the black pair is in this
 * repo. A black badge on `--ink` is both invisible and off-guideline, and the
 * badge art itself must never be recoloured to fix that. Paper also lets the
 * app icon's own navy read as a tile instead of dissolving into the footer.
 *
 * This replaces the `WalletBand` deleted in the paper/lime redesign — that one
 * was built for the old terminal-ledger theme and used a keyed product render.
 * Here the mark does the work: two app icons and a multiplication sign.
 */

const STORES = [
  {
    href: "https://apps.apple.com/us/app/robinhood-wallet/id1634080733",
    // The badge art is Apple's and Google's own, identical for every app, so it
    // lives in `/store/` rather than under one vendor — the Paybox row uses the
    // same two files. Never recolour or resize them past the `.store-badge` rules.
    src: "/store/appstore-badge.png",
    alt: "Download Robinhood Wallet on the App Store",
  },
  {
    // The Android package is com.robinhood.gateway, not .wallet.
    href: "https://play.google.com/store/apps/details?id=com.robinhood.gateway",
    src: "/store/googleplay-badge.png",
    alt: "Get Robinhood Wallet on Google Play",
  },
];

export function WalletLockup() {
  return (
    /*
     * A band on `--paper-alt`, not the page's own paper.
     *
     * Measured, the two grounds were pixel-identical — but this is the only paper
     * section with the lime band above it and the black footer below, so it read
     * brighter than every other one. One step down settles it, and gives the
     * co-brand its own zone, which suits a block that is about someone else.
     */
    <section id="wallet" className="wallet-band border-t border-[var(--line-soft)]">
      <div className="shell py-[clamp(72px,9vw,112px)]">
        <div className="eyebrow">wallet</div>

        {/* Full width, wrapping freely. This headline is far longer than the
            one-phrase section titles the `.duo` split was built for — inside a
            half column it overran into the lede at every width above 900px. */}
        <h2 className="h-section mt-[18px]">
          {/* The `{" "}` are load-bearing. JSX drops the newline between text and
              an adjacent element, so writing these on separate lines glues them
              into `Names×Robinhood` — one unbreakable 369px token that overran
              the phone by 19px while the sign's padding made it *look* spaced. */}
          HoodFi Names{" "}
          <span className="lockup-x" aria-hidden>
            ×
          </span>{" "}
          {/* Break after the sign, so the two names stack as a lockup rather than
              wrapping mid-phrase. Only once "Robinhood Wallet" fits a line on its
              own — below that the browser's own wrap is the better of two bad
              options. */}
          <br className="hidden min-[900px]:block" />
          Robinhood Wallet
        </h2>

        <p className="lede mt-6 max-w-[52ch]">
          Making sending and receiving crypto simple and safe — on the chain your
          name already lives on.
        </p>

        {/* The lockup itself: both marks at the same optical size, the sign
            between them, and the two badges closing the row. Stacks below 980px,
            where the three blocks side by side crush the copy to a ribbon.
            Plain paper, not `.panel` — on this band `--paper-alt` is the ground,
            so a `.panel` fill would make the card vanish into it. */}
        <div className="shadow-lime mt-11 flex flex-col gap-8 border border-[var(--line-card)] bg-[var(--paper)] p-[clamp(24px,3.4vw,40px)] min-[980px]:flex-row min-[980px]:items-center min-[980px]:gap-10">
          <div className="flex flex-none items-center gap-6">
            <Image
              src="/hoodfi-h.png"
              alt="HoodFi Names"
              width={512}
              height={512}
              className="h-[76px] w-[76px] object-contain"
            />
            <span className="lockup-sign" aria-hidden>
              ×
            </span>
            <Image
              src="/robinhood/robinhood-wallet-app-icon.png"
              alt="Robinhood Wallet"
              width={512}
              height={512}
              /* The icon ships square; app icons are always seen masked. */
              className="h-[76px] w-[76px] rounded-[18px]"
            />
          </div>

          <div className="min-[980px]:flex-1">
            <div className="label">Robinhood Wallet</div>
            {/* Robinhood Wallet has NOT integrated ENS. It cannot send *to* a
                name. Receiving works because resolution happens in the sender's
                wallet, so that is how this has to be phrased — do not restore any
                wording that claims the app itself resolves a name. */}
            <p className="mt-2 max-w-[38ch] text-[15px] leading-[1.55] text-[var(--dim)]">
              Self-custody, with Robinhood Chain built in. Point your name at it and
              anyone can pay you there.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3.5 min-[980px]:flex-none">
            {STORES.map((store) => (
              <a
                key={store.href}
                href={store.href}
                target="_blank"
                rel="noopener noreferrer"
                className="store-badge"
              >
                {/* Apple and Google both require the badge unmodified, so the
                    focus ring sits outside it in the badge's own clear space. */}
                <Image
                  src={store.src}
                  alt={store.alt}
                  width={419}
                  height={141}
                  priority={false}
                />
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
