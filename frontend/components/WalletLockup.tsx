import Image from "next/image";

/**
 * The wallet recommendation, between the closing CTA and the footer.
 *
 * This is HoodFi's own recommendation, NOT a partnership — there is no
 * agreement with Robinhood of any kind. It read as a co-brand until the
 * 2026-09 pass: a `Names × Robinhood Wallet` headline over a two-icon lockup
 * joined by a multiplication sign, which is the visual grammar of a deal. Both
 * are gone. One mark, one voice, and a disclaimer under the card. Do not
 * reintroduce the `×`, a second icon beside it, or any "together"/"partner"
 * phrasing — that is the whole reason this file was rewritten.
 *
 * Kept on paper rather than ink for one hard reason: Apple ships a black badge
 * for light grounds and a white one for dark, and only the black pair is in this
 * repo. A black badge on `--ink` is both invisible and off-guideline, and the
 * badge art itself must never be recoloured to fix that. Paper also lets the
 * app icon's own navy read as a tile instead of dissolving into the footer.
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
     * recommendation its own zone, which suits a block that is about someone else.
     */
    <section id="wallet" className="wallet-band border-t border-[var(--line-soft)]">
      <div className="shell py-[clamp(72px,9vw,112px)]">
        <div className="eyebrow">recommended wallet</div>

        {/* Full width, as the co-brand heading was — it had to be, being far
            longer than the `.duo` split allows. This one would fit a half column,
            but the band keeps the full measure so the section still opens at the
            same width as the lede and card beneath it. */}
        <h2 className="h-section mt-[18px]">Which wallet we recommend.</h2>

        <p className="lede mt-6 max-w-[52ch]">
          A name is only as useful as the wallet holding it. Robinhood Chain is new
          enough that most wallets have not added it yet — this is the one we point
          people to.
        </p>

        {/* One mark, not two. Stacks below 980px, where the three blocks side by
            side crush the copy to a ribbon. Plain paper, not `.panel` — on this
            band `--paper-alt` is the ground, so a `.panel` fill would make the
            card vanish into it. */}
        <div className="shadow-lime mt-11 flex flex-col gap-8 border border-[var(--line-card)] bg-[var(--paper)] p-[clamp(24px,3.4vw,40px)] min-[980px]:flex-row min-[980px]:items-center min-[980px]:gap-10">
          <Image
            src="/robinhood/robinhood-wallet-app-icon.png"
            alt="Robinhood Wallet"
            width={512}
            height={512}
            /* The icon ships square; app icons are always seen masked. */
            className="h-[76px] w-[76px] flex-none rounded-[18px]"
          />

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

        {/* The line that makes the recommendation a recommendation. It is doing
            real work directly under a card of someone else's brand art — keep it
            adjacent to the card, not exiled to the footer. */}
        <p className="mt-6 max-w-[62ch] text-sm leading-[1.6] text-[var(--faint)]">
          HoodFi Names is independent and has no affiliation with Robinhood. Your
          name is an ERC-721 you hold yourself, so any wallet that supports
          Robinhood Chain will do — this is simply the one we use.
        </p>
      </div>
    </section>
  );
}
