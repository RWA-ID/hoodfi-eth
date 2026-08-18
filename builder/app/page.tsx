"use client";

import { useState } from "react";
import { ConnectButton } from "@/components/ConnectButton";
import { NamePicker } from "@/components/NamePicker";
import type { OwnedName } from "@/components/useMyNames";
import { decodeContenthash } from "@/shared/contenthash";

/**
 * Phase 0 shell. The wizard proper lands on top of this: template, content, preview,
 * pay, publish. What is here is the part everything else depends on — a connected
 * wallet and one chosen name — plus a live check that the shared codec resolves through
 * the symlink, which is the structural question this phase existed to answer.
 */
export default function Home() {
  const [selected, setSelected] = useState<OwnedName | null>(null);

  // A known-good IPFS contenthash. If the symlink to ../frontend/shared ever stops
  // resolving, this is a build error rather than a runtime surprise at publish time.
  const probe = decodeContenthash(
    "0xe30101701220997b23f7551dc1993c49dc185ea76bbc07d6eb66e121c09c255eebcfa9fc4123"
  );

  return (
    <main className="shell">
      <header className="flex items-center justify-between py-6">
        <span className="data text-[13px] font-semibold">
          HoodFi <span className="opacity-50">Sites</span>
        </span>
        <ConnectButton />
      </header>

      <section className="section">
        <p className="eyebrow">Build</p>
        <h1 className="h-hero">Your name, as a website.</h1>
        <p className="lede mt-4 max-w-[52ch]">
          Pick a template, add your details, and publish. The site lives on IPFS and your
          name serves it — no hosting, no renewals, nothing to keep paying for.
        </p>
      </section>

      <section className="section">
        <NamePicker onSelect={setSelected} selected={selected} />

        {selected ? (
          <div className="panel mt-4 p-6">
            <p className="label">Building on</p>
            <p className="h-panel mt-2">
              {selected.label}
              <span className="opacity-50">.hoodfi.eth</span>
            </p>
            <p className="lede mt-3">
              Published here, this site will be reachable at{" "}
              <span className="data">{selected.label}.hoodfi.eth.link</span>.
            </p>
          </div>
        ) : null}
      </section>

      <footer className="hairline-t py-6">
        <p className="data text-[12px] opacity-50">
          codec ok — {probe?.protocol}:{probe?.id.slice(0, 12)}…
        </p>
      </footer>
    </main>
  );
}
