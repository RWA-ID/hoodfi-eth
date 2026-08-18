"use client";

import { useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { StartPanel } from "@/components/StartPanel";
import { ArrowNE } from "@/components/ArrowNE";
import { FaqAccordion, type FaqItem } from "@/components/FaqAccordion";
import type { OwnedName } from "@/components/useMyNames";
import { FIRST_USD, REBUILD_USD } from "@/lib/labels";

/** The four looks. Order is the order they appear in the grid. */
const TEMPLATES: { id: string; name: string; blurb: string; note: string }[] = [
  {
    id: "01",
    name: "Terminal",
    blurb: "Black ground, acid nav, everything set in a bitmap mono.",
    note: "Collectors and PFP holders",
  },
  {
    id: "02",
    name: "Editorial",
    blurb: "Paper ground, one lime field, display type at full height.",
    note: "Personal identity",
  },
  {
    id: "03",
    name: "Manifesto",
    blurb: "Pure black, enormous wide type, a single accent word.",
    note: "Projects and founders",
  },
  {
    id: "04",
    name: "Product",
    blurb: "Light, generous, a generative field behind the headline.",
    note: "Teams and tools",
  },
];

/** What actually happens, in the order it happens. */
const STEPS: [string, string][] = [
  ["connect", "Connect the wallet holding your name. We read your names off Robinhood Chain — nothing to type."],
  ["choose", "Pick one name and one of four templates. Your existing records fill the first draft in."],
  ["edit", "Add a picture, a bio, your links and anything else. Preview updates as you type."],
  ["publish", "Pay once, the site pins to IPFS, and you sign one transaction to point your name at it."],
];

/** Six claims, each one checkable. Mirrors the site's ledger. */
const FACTS: [string, string][] = [
  ["hosting", "None to pay for. The site is pinned to IPFS and served through your own name."],
  ["address", "Your site answers at <name>.hoodfi.eth.link — no extra domain, no DNS."],
  ["ownership", "The contenthash record is yours. You sign it; we never hold a key to your name."],
  ["renewals", "None. There is no expiry on a HoodFi name and no subscription on a site."],
  ["portability", "You keep the CID. Point the name anywhere else, any time, without asking us."],
  ["edits", "Come back and change anything. The site remembers what you built."],
];

const FAQ: FaqItem[] = [
  {
    q: "Do I need a HoodFi name first?",
    a: "To publish, yes — the site is served by your name, so there has to be a name to serve it. You can design the whole thing before you have one, and you'll be prompted to mint at the point you publish.",
  },
  {
    q: `What does ${FIRST_USD} pay for?`,
    a: "Building and publishing a site on one name: the templates, the editor, and pinning the finished site to IPFS so it stays online. It is charged once per name, not per month.",
  },
  {
    q: "Why does rebuilding cost extra?",
    a: `Republishing pins a whole new copy of your site and keeps it online, which is a real ongoing cost rather than a one-off. Rebuilds are ${REBUILD_USD} — less than the first publish, and only when you actually change something.`,
  },
  {
    q: "Who controls the site once it's published?",
    a: "You do, completely. The record that points your name at the site is written by you, from your wallet, onto a name you own. Nothing here can change or remove it, and the CID stays valid whatever we do.",
  },
  {
    q: "Can I use my own domain?",
    a: "Your site is reachable at <name>.hoodfi.eth.link with no setup at all. Anything IPFS-addressable can also be put behind a domain you own — but that's yours to configure, and you don't need it.",
  },
  {
    q: "What happens to my site if this shuts down?",
    a: "It stays up. The site is a static bundle on IPFS and the pointer is a record on your own name, neither of which depends on us. Keeping a copy of your CID pinned elsewhere is always worth doing.",
  },
  {
    q: "Can I move a published site to a different name?",
    a: "Yes — the same CID can be set as the contenthash on any name you own. Publishing through the builder on a second name is charged separately, but pointing a name at a CID you already have is just a record you write.",
  },
];

export default function Home() {
  const [selected, setSelected] = useState<OwnedName | null>(null);

  return (
    <>
      <Header />
      <main id="top">
        {/* ── Hero. The only lime field above the fold, with the start panel as the
            one dark object in it — the same composition as the site's mint page. */}
        <section className="on-lime border-b border-[var(--ink)]">
          <div className="shell grid items-start gap-14 pb-[68px] pt-[clamp(48px,6vw,76px)] [grid-template-columns:repeat(auto-fit,minmax(min(100%,400px),1fr))]">
            {/* The size container the headline is measured against. It must be this
                element, not the <h1>: `cqi` resolves against the nearest container
                ancestor, so the box being sized cannot be the one establishing it. */}
            <div className="[container-type:inline-size]">
              <div className="eyebrow">Websites · IPFS · your name</div>
              {/* Explicit <br>: the prod minifier eats the space around a natural
                  line break and fuses the words. */}
              <h1 className="h-hero mt-[22px]">
                Your name
                <br />
                is the site
              </h1>
              <p className="mt-[30px] max-w-[40ch] text-[19px] font-medium leading-[1.5] text-pretty">
                Pick a template, add your details, publish. Your{" "}
                <span className="data text-[17px]">*.hoodfi.eth</span> name serves the
                site itself — no hosting, no renewals, nothing to keep paying for.
              </p>
              <div className="mt-[34px] flex flex-wrap gap-2.5">
                <a href="#templates" className="btn btn-ink">
                  See the templates <ArrowNE />
                </a>
                <a href="#how" className="btn btn-ghost">
                  How it works
                </a>
              </div>
            </div>

            <StartPanel onSelect={setSelected} selected={selected} />
          </div>
        </section>

        {/* ── The four numbers. Constants of the product, so no live reads here — the
            site's StatBar earns "LIVE" from the chain; this one would be pretending. */}
        <div className="on-ink border-b border-[var(--line-soft)]">
          <div className="shell cells">
            {[
              ["templates", "4", "to choose from"],
              ["first site", FIRST_USD, "once, per name"],
              ["rebuilds", REBUILD_USD, "only when you change it"],
              ["hosting", "$0", "forever"],
            ].map(([label, value, note], i) => (
              <div
                key={label}
                className={`flex-[1_1_200px] px-6 py-7 ${
                  i === 0 ? "" : "border-l border-[var(--line-soft)]"
                }`}
              >
                <div className="label">{label}</div>
                <div className="stat mt-3 text-[var(--fg)]">{value}</div>
                <div className="mt-2 text-[13px] text-[var(--faint)]">{note}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── 01 — templates */}
        <section id="templates" className="shell section">
          <div className="eyebrow">01 / pick a look</div>
          <div className="duo mt-[18px] items-end">
            <h2 className="h-section m-0">Four templates.</h2>
            <p className="lede m-0 mb-2.5 max-w-[44ch]">
              Four genuinely different designs, not four colourways of one. Each is a
              single self-contained page — no framework, no external fonts, nothing that
              can go offline later.
            </p>
          </div>

          {/* Border-top + left on the container, right + bottom per cell: dividers
              never double up, and the rectangle stays closed on the last row because
              children grow rather than sitting in auto-fit columns. */}
          <div className="cells mt-[52px] border-l border-t border-[var(--line)]">
            {TEMPLATES.map((t) => (
              <div
                key={t.id}
                className="flex-[1_1_300px] border-b border-r border-[var(--line)] p-7"
              >
                <div className="data text-[11px] tracking-[0.14em] text-[var(--faint)]">
                  {t.id}
                </div>
                <div className="mt-4 text-[24px] font-extrabold leading-none tracking-[-0.03em]">
                  {t.name}
                </div>
                <p className="mt-3 text-[15px] leading-[1.6] text-[var(--dim)]">{t.blurb}</p>
                <div className="label mt-5">{t.note}</div>
              </div>
            ))}
          </div>
          <p className="data mt-5 text-[12px] text-[var(--faint)]">
            Previews land as each template is finished.
          </p>
        </section>

        {/* ── 02 — how it works */}
        <section id="how" className="shell section">
          <div className="eyebrow">02 / how it works</div>
          <h2 className="h-section mt-[18px] max-w-[15ch]">Four steps, one signature.</h2>
          <div className="duo mt-[52px] items-start">
            <div className="min-w-0 border-t border-[var(--line)]">
              {STEPS.map(([key, value]) => (
                <div key={key} className="ledger-row">
                  <div className="label">{key}</div>
                  <div className="text-[15.5px] leading-[1.6] text-[var(--dim)]">{value}</div>
                </div>
              ))}
            </div>
            <div className="min-w-0 border-t border-[var(--line)]">
              {FACTS.map(([key, value]) => (
                <div key={key} className="ledger-row">
                  <div className="label">{key}</div>
                  <div className="text-[15.5px] leading-[1.6] text-[var(--dim)]">{value}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 03 — pricing */}
        <section id="pricing" className="shell section">
          <div className="eyebrow">03 / pricing</div>
          <div className="duo mt-[18px] items-end">
            <h2 className="h-section m-0">Paid once, not monthly.</h2>
            <p className="lede m-0 mb-2.5 max-w-[44ch]">
              Pay in ETH or USDG on Robinhood Chain, the same as minting a name. There is
              no subscription and no account to cancel.
            </p>
          </div>

          {/* `.panel` supplies the --paper-alt fill and it cannot be overridden with a
              `bg-*` utility here: globals.css is unlayered and Tailwind's utilities sit
              in a layer, so the bare class wins regardless of source order. The alt fill
              is the right ground under a lime shadow anyway — on flat --paper the card
              would be defined by its shadow alone. */}
          <div className="cells mt-[52px] gap-6">
            <div className="panel shadow-lime min-w-0 flex-[1_1_320px] p-8">
              <div className="label">First site on a name</div>
              <div className="mt-4 flex items-baseline gap-3">
                <span className="h-panel">{FIRST_USD}</span>
                <span className="data text-[13px] text-[var(--faint)]">one time</span>
              </div>
              <p className="mt-5 text-[15px] leading-[1.6] text-[var(--dim)]">
                Everything: all four templates, the editor, image hosting and the pin
                that keeps your site online. Charged per name, so it moves with the name
                if you ever sell it.
              </p>
            </div>

            <div className="panel shadow-lime min-w-0 flex-[1_1_320px] p-8">
              <div className="label">Rebuild</div>
              <div className="mt-4 flex items-baseline gap-3">
                <span className="h-panel">{REBUILD_USD}</span>
                <span className="data text-[13px] text-[var(--faint)]">per republish</span>
              </div>
              <p className="mt-5 text-[15px] leading-[1.6] text-[var(--dim)]">
                Change the design or the content and publish again. Only charged when
                you actually republish — coming back to look at your site costs nothing.
              </p>
            </div>
          </div>

          <p className="data mt-6 text-[12px] leading-[1.7] text-[var(--faint)]">
            Gas on Robinhood Chain is a fraction of a cent. You also sign one transaction
            on your own name to point it at the finished site.
          </p>
        </section>

        {/* ── 04 — FAQ */}
        <section id="faq" className="shell section">
          <div className="eyebrow">04 / questions</div>
          <h2 className="h-section mt-[18px] max-w-[14ch]">Before you build.</h2>
          <div className="mt-[52px]">
            <FaqAccordion items={FAQ} />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
