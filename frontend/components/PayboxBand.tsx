import Image from "next/image";
import Link from "next/link";
import { ArrowNE } from "@/components/ArrowNE";
import { PayboxFlipWord } from "@/components/PayboxFlipWord";
import { PAYBOX_APPS, PAYBOX_URL } from "@/lib/paybox";

/**
 * The home teaser: your AI app can buy a name now, here is where that is explained.
 *
 * ## Why this band is on paper-alt and not lime
 *
 * It was drawn on lime. The handoff left the call to code review because the page
 * already closes on a lime CTA, and the two together would have put a second lime
 * field directly against the first — at which point neither reads as the accent.
 * Sitting it between the FAQ and that CTA gives the run
 * `paper → paper-alt → lime → paper-alt`, so the closing lime keeps the emphasis it
 * was built to carry and this band still gets a ground of its own.
 *
 * The one consequence to keep in mind: on lime the connector cells were drawn with
 * full-strength ink hairlines, because `--line-card` resolves to `var(--ink)` inside
 * `.on-lime`. On paper-alt that same weight reads as a table someone forgot to style,
 * so the rules step down to the ordinary card hairline and the cells sit on `--paper`
 * to lift off the band.
 *
 * The headline is `.h-page`, not `.h-section`: a teaser band should sit a step under
 * the numbered openers above it. Worth knowing before reaching for a Tailwind size
 * here — every `.h-*` class is unlayered, so its `font-size` beats a utility trying to
 * override it. Change the class, not the size.
 */
export function PayboxBand() {
  return (
    <section
      id="paybox"
      /* `mt-28` is the gap the closing CTA used to hold: this band took its place
         directly under the FAQ, and the CTA now butts against it. */
      className="wallet-band mt-28 border-y border-[var(--line-soft)]"
    >
      <div className="shell grid items-center gap-12 py-[clamp(48px,6vw,72px)] [grid-template-columns:repeat(auto-fit,minmax(min(100%,400px),1fr))]">
        <div>
          <div className="eyebrow">new · paybox connector</div>

          {/* `.h-page` rather than the drawn literal: a step down from the
              `.h-section` openers above, which is what the band wants, and within
              2px of the handoff's clamp at every width. */}
          <h2 className="h-page mt-5 max-w-[20ch]">
            {/* The cycling word is aria-hidden, so the sentence is spelled out once
                here for anything that reads rather than looks. */}
            <span className="sr-only">
              Now your AI app can buy a HoodFi Name.
            </span>
            <span aria-hidden>
              Now your <PayboxFlipWord /> can buy a HoodFi Name.
            </span>
          </h2>

          <p className="mt-6 max-w-[46ch] text-[17px] font-medium leading-[1.5] text-[var(--dim)] text-pretty">
            Add the PayBox connector to your AI app, then just ask. PayBox reaches
            the HoodFi Names MCP, pays from your own vault, and the lifetime
            ERC&#8209;721 is yours.
          </p>

          <div className="mt-[30px] flex flex-wrap gap-2.5">
            {/* Trailing slash before the hash: `trailingSlash: true` plus a static
                export means `/mcp#paybox` is a redirect on a gateway, not a route. */}
            <Link href="/mcp/#paybox" className="btn btn-ink btn-lg">
              See how it works <ArrowNE />
            </Link>
            <a
              href={PAYBOX_URL}
              target="_blank"
              rel="noreferrer"
              className="btn btn-ghost btn-lg"
            >
              Visit paybox.sh
            </a>
          </div>
        </div>

        {/* Bordered stack: rules on the container's top and left, on each cell's
            right and bottom, so no hairline is ever drawn twice.

            `.shadow-lime` goes on the container, never on the cells: the cells
            share their hairlines, so a per-cell offset would paint lime bars
            between the rows rather than past the block's edge. The band's own
            `bg-[var(--paper)]` is what the offset reads against — without a fill
            the paper-alt band would show straight through it. */}
        <div className="cells shadow-lime border-l border-t border-[var(--line-card)] bg-[var(--paper)]">
          {PAYBOX_APPS.map((app) => (
            <div
              key={app.id}
              className="flex min-h-[96px] flex-[1_1_100%] items-center gap-[18px] border-r border-b border-[var(--line-card)] px-6 py-5"
            >
              {/* A fixed slot with the art fitted inside it, rather than a width on
                  the image: the three lockups have different aspect ratios, and
                  sizing them by width alone makes Grok tower over Claude. */}
              <span className="flex h-[26px] w-[148px] flex-none items-center">
                <Image
                  src={app.lockup.src}
                  alt={app.label}
                  width={app.lockup.width}
                  height={app.lockup.height}
                  className="block h-auto max-h-full w-auto max-w-full"
                />
              </span>
              <span className="data ml-auto text-[11px] uppercase tracking-[0.16em] text-[var(--olive)]">
                connector ready
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
