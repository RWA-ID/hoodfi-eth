import type { Metadata } from "next";
import Link from "next/link";
import { ArrowNE } from "@/components/ArrowNE";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { PageView } from "@/components/PageView";
import { PayboxSection } from "@/components/PayboxSection";
import { ogMetadata } from "@/lib/metadata";
import { MCP_URL } from "@/lib/site";

export const metadata: Metadata = ogMetadata({
  title: "MCP server",
  description:
    "Let an AI agent register a *.hoodfi.eth name and set its records. A remote MCP server that checks availability, quotes a price and returns unsigned calldata — it holds no keys and never broadcasts.",
  path: "/mcp/",
  image: "/og/mcp.png",
});

/**
 * The agent-facing page.
 *
 * Written for someone wiring a tool into a client, so it leads with the endpoint and
 * the two constraints that surprise people, rather than with the pitch. The route also
 * has to exist for its own sake: `vercel.json` rewrites any bare `/[a-z0-9-]{1,32}` to
 * the gateway's name card, so without a page here `/mcp` would resolve to a lookup for
 * a name called "mcp". Filesystem routes are matched before rewrites, so this claims it.
 */

const TOOLS = [
  {
    name: "hoodfi_check_name",
    body: "Availability and price for a name, in ETH and USDG together. When a name can't be had it says why — taken, reserved, or too short to sell yet.",
  },
  {
    name: "hoodfi_build_registration_tx",
    body: "The unsigned transaction that registers a name. One step paying in ETH, up to two paying in USDG, each with its own calldata and chain id.",
  },
  {
    name: "hoodfi_resolve_name",
    body: "Owner, address records, text records and website for a name that's already minted. The same data the profile card reads.",
  },
  {
    name: "hoodfi_build_set_contenthash_tx",
    body: "The unsigned transaction that points a name at an IPFS or IPNS site, so it answers at name.hoodfi.eth.link with no DNS and no host. Owner-only, and checked against the owner before any calldata comes back.",
  },
  {
    name: "hoodfi_build_set_address_tx",
    body: "The unsigned transaction that sets the name's Ethereum, Bitcoin and Solana addresses. Any combination in one call, batched so the owner signs once — and an address that isn't valid for its chain is refused rather than stored.",
  },
];

const CLIENT_CONFIG = `{
  "mcpServers": {
    "hoodfi": {
      "type": "http",
      "url": "${MCP_URL}"
    }
  }
}`;

/** Ink-ground code block — the one place on the site type goes monospace at length. */
function Code({ children }: { children: string }) {
  return (
    <pre className="panel panel-ink on-ink data overflow-x-auto p-5 text-[12.5px] leading-[1.75] text-[var(--fg)]">
      <code>{children}</code>
    </pre>
  );
}

export default function McpPage() {
  return (
    <>
      <PageView />
      <Header />
      <main>
        <section className="shell pt-[clamp(40px,5vw,64px)]">
          <div className="duo items-end">
            <div>
              <div className="eyebrow">for agents / mcp</div>
              <h1 className="h-page mt-[18px]">
                Let an agent register its own name.
              </h1>
            </div>
            <p className="lede m-0 mb-2.5 max-w-[46ch]">
              An MCP server that answers what a name costs, hands back the transaction
              that mints it, then points it at a website and at addresses on Ethereum,
              Bitcoin and Solana. It holds no keys and broadcasts nothing — the agent
              signs, the agent owns.
            </p>
          </div>

          <div className="mt-11">
            <div className="label">endpoint</div>
            {/* Capped rather than full-bleed: one short line of mono in a 1300px black
                bar reads as a banner, not as something you copy. */}
            <div className="mt-3 max-w-[640px]">
              <Code>{MCP_URL}</Code>
            </div>
            <p className="data mt-4 max-w-[88ch] text-[11.5px] leading-[1.7] text-[var(--faint)]">
              Streamable HTTP, stateless. No session is issued and no key is held, so
              there is nothing to revoke and nothing to steal.
            </p>
          </div>
        </section>

        <section className="shell section">
          <div className="eyebrow">01 / tools</div>
          <h2 className="h-page mt-[18px]">Five of them.</h2>
          <div className="cells mt-11 border-t border-l border-[var(--line)]">
            {TOOLS.map((tool) => (
              <div
                key={tool.name}
                className="flex-[1_1_280px] border-b border-r border-[var(--line)] p-6"
              >
                <div className="data text-[12.5px] tracking-[0.02em] text-[var(--olive)]">
                  {tool.name}
                </div>
                <p className="mt-3 text-sm leading-relaxed text-[var(--dim)]">
                  {tool.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="shell section">
          <div className="eyebrow">02 / three rules</div>
          <h2 className="h-page mt-[18px]">Worth knowing before you wire it up.</h2>
          {/* `.shadow-lime` on each panel rather than `.shadow-card`: these three
              and the PayBox cards below are the agent-facing blocks, and the lime
              offset is what ties them together down the page. The `.duo` gap is
              what makes it safe — the offset needs clear space to land in, so it
              never goes on the shared-hairline grids above. */}
          <div className="duo mt-11">
            <div className="panel shadow-lime p-7">
              <h3 className="h-sub m-0">The signer owns the name.</h3>
              <p className="mt-3.5 text-sm leading-relaxed text-[var(--dim)]">
                The registrar mints to whoever sends the transaction. There is no
                recipient argument, so an agent cannot register a name on someone
                else&apos;s behalf — it registers for itself, with its own wallet, and
                that wallet needs funds on Robinhood Chain.
              </p>
            </div>
            <div className="panel shadow-lime p-7">
              <h3 className="h-sub m-0">Four characters and up.</h3>
              <p className="mt-3.5 text-sm leading-relaxed text-[var(--dim)]">
                One, two and three character names are premium inventory, reserved for
                donors spending short-name credits until the 100-year goal is reached.
                They can&apos;t be bought at any price today, by an agent or anyone
                else.{" "}
                <Link href="/short-names/" className="link">
                  How that works
                </Link>
                .
              </p>
            </div>
          </div>

          {/* Full width rather than a third cell in the .duo above: three items in
              that grid orphan the last one at medium widths, and this is a different
              kind of warning from the two mechanics ones — it is about funds.

              `mt-14`, not the `mt-3.5` this used to carry: the offset shadow is
              14px, so at the old spacing the lime landed flush on this panel's top
              border and read as a rule joining the two rows. 56px is the `.duo`
              gap, which is the grid the shadow now has to clear. */}
          <div className="panel shadow-lime mt-14 p-7">
            <h3 className="h-sub m-0">
              An address record is a payment instruction.
            </h3>
            <p className="mt-3.5 max-w-[76ch] text-sm leading-relaxed text-[var(--dim)]">
              A name can carry Ethereum, Bitcoin and Solana addresses, and the server
              refuses one that isn&apos;t valid for its chain. How much that proves is
              not the same everywhere: Bitcoin is checksummed, so a typo is caught;
              Ethereum is only verified when the address carries EIP-55 capitalisation;
              and a Solana address has no checksum at all, so a mistyped one is a
              different, equally valid-looking key that nothing can detect. The tool
              returns a{" "}
              <span className="data text-[12.5px] text-[var(--olive)]">verify</span>{" "}
              field saying which case applies — relay it rather than reporting the
              address as checked.
            </p>
          </div>
        </section>

        <section className="shell section">
          <div className="eyebrow">03 / connect</div>
          <h2 className="h-page mt-[18px]">Point a client at it.</h2>
          <div className="duo mt-11 items-start">
            <div>
              <div className="label">any mcp client</div>
              <div className="mt-3">
                <Code>{CLIENT_CONFIG}</Code>
              </div>
            </div>
            <div>
              <div className="label">claude code</div>
              <div className="mt-3">
                <Code>{`claude mcp add --transport http \\\n  hoodfi ${MCP_URL}`}</Code>
              </div>
              <p className="data mt-4 text-[11.5px] leading-[1.7] text-[var(--faint)]">
                No API key, no account, no allowlist. The server is read-only and the
                only thing it can produce is calldata you are free to inspect before
                signing.
              </p>
            </div>
          </div>
        </section>

        <PayboxSection />

        <section className="on-lime mt-28 border-y border-[var(--ink)]">
          <div className="shell py-[clamp(56px,7vw,88px)] text-center">
            <h2 className="h-cta m-0 mx-auto max-w-[22ch]">
              Your agent&apos;s name is probably still free
            </h2>
            <div className="mt-10 flex flex-wrap justify-center gap-2.5">
              <Link href="/mint/" className="btn btn-ink btn-lg">
                Mint one yourself <ArrowNE />
              </Link>
              <a
                href="https://github.com/RWA-ID/hoodfi-eth/tree/main/mcp"
                target="_blank"
                rel="noreferrer"
                className="btn btn-ghost btn-lg"
              >
                Read the source <ArrowNE />
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
