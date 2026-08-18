"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SiteForm } from "@/components/SiteForm";
import { SitePreview } from "@/components/SitePreview";
import { TemplatePicker } from "@/components/TemplatePicker";
import { useMyNames, type OwnedName } from "@/components/useMyNames";
import { useNameRecords } from "@/components/useNameRecords";
import { loadDraft, saveDraft } from "@/lib/draft";
import { EMPTY_SITE, TEMPLATES_BY_ID, type SiteData, type TemplateId } from "@/lib/templates/index.ts";
import { MINT_URL } from "@/lib/site";
import { ArrowNE } from "@/components/ArrowNE";
import { PublishPanel } from "@/components/PublishPanel";

/**
 * The editor.
 *
 * One page, not a wizard: name and template at the top, the form on the left, the real
 * page on the right. Everything a visitor types re-renders the preview through the same
 * function that produces the pinned file, so what they are looking at is the artefact
 * rather than an impression of it.
 */
export default function BuildPage() {
  const { address, isConnected } = useAccount();
  const { names, loading, error, unconfigured } = useMyNames(address);

  const [name, setName] = useState<OwnedName | null>(null);
  const [templateId, setTemplateId] = useState<TemplateId>("terminal");
  const [data, setData] = useState<SiteData>(EMPTY_SITE);

  // Which node the state on screen belongs to. Without this, switching names would
  // carry the previous name's draft across and quietly offer to publish it.
  const loadedFor = useRef<string>("");
  const [edited, setEdited] = useState(false);

  const { prefill } = useNameRecords(name?.node);

  // Pick the first name automatically. One name is the common case and making someone
  // click it is asking them to confirm a fact they already know.
  useEffect(() => {
    if (!name && names.length > 0) setName(names[0]);
    if (name && !names.some((n) => n.node === name.node)) setName(null);
  }, [names, name]);

  // Load whatever exists for this name: a saved draft first, then the chain records,
  // then nothing. A draft always wins — it is the newer edit by definition.
  useEffect(() => {
    if (!name || loadedFor.current === name.node) return;
    loadedFor.current = name.node;

    const draft = loadDraft(name.node);
    if (draft) {
      setTemplateId(draft.templateId);
      setData({ ...draft.data, label: name.label });
      setEdited(draft.edited);
      return;
    }
    setData({ ...EMPTY_SITE, label: name.label });
    setEdited(false);
  }, [name]);

  // Records arrive after the draft check, so only fill fields still untouched. A
  // prefill that overwrote an edit would be worse than no prefill at all.
  useEffect(() => {
    if (!name || !prefill || edited) return;
    setData((current) => {
      const next = { ...current };
      for (const [k, v] of Object.entries(prefill)) {
        if (!v) continue;
        const key = k as keyof SiteData;
        if (key === "links" || key === "label") continue;
        if (!next[key]) (next as Record<string, unknown>)[key] = v;
      }
      return next;
    });
  }, [prefill, name, edited]);

  // Autosave. Cheap, and it is the whole reason a wallet round trip on a phone does not
  // destroy the work.
  useEffect(() => {
    if (!name || !edited) return;
    const t = setTimeout(() => saveDraft(name.node, { templateId, data, edited }), 400);
    return () => clearTimeout(t);
  }, [name, templateId, data, edited]);

  const update = (next: SiteData) => {
    setData(next);
    setEdited(true);
  };

  const template = TEMPLATES_BY_ID[templateId];
  const html = useMemo(
    () => template.render({ ...data, label: data.label || name?.label || "yourname" }),
    [template, data, name]
  );

  const sizeKb = (new TextEncoder().encode(html).length / 1024).toFixed(1);

  return (
    <>
      <Header />
      <main id="top">
        <section className="on-lime border-b border-[var(--ink)]">
          <div className="shell py-8">
            <div className="flex flex-wrap items-end justify-between gap-5">
              <div className="min-w-0">
                <div className="eyebrow">Editor</div>
                <h1 className="mt-3 text-[clamp(28px,4vw,44px)] font-extrabold leading-[0.95] tracking-[-0.04em]">
                  {name ? (
                    <>
                      {name.label}
                      <span className="opacity-45">.hoodfi.eth</span>
                    </>
                  ) : (
                    "Build a site"
                  )}
                </h1>
              </div>

              {names.length > 1 ? (
                <div className="flex flex-wrap gap-2">
                  {names.map((n) => (
                    <button
                      aria-pressed={n.node === name?.node}
                      className={`data cursor-pointer border px-3 py-2 text-[12.5px] transition-colors ${
                        n.node === name?.node
                          ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]"
                          : "border-[var(--ink)] hover:bg-[var(--hover-fill)]"
                      }`}
                      key={n.node}
                      onClick={() => setName(n)}
                      type="button"
                    >
                      {n.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {!isConnected ? (
          <div className="shell section">
            <p className="lede max-w-[46ch]">
              Connect the wallet holding your name to start building.
            </p>
          </div>
        ) : unconfigured ? (
          <div className="shell section">
            <p className="warn max-w-[54ch]">
              This deployment isn&rsquo;t configured to read names yet, so we can&rsquo;t
              tell what you hold. This is our problem, not your wallet&rsquo;s — nothing
              is wrong with your name.
            </p>
          </div>
        ) : error ? (
          <div className="shell section">
            <p className="warn max-w-[52ch]">{error}</p>
          </div>
        ) : loading && names.length === 0 ? (
          <div className="shell section">
            <p className="lede">Reading your names off Robinhood Chain…</p>
          </div>
        ) : names.length === 0 ? (
          <div className="shell section">
            <p className="lede max-w-[48ch]">
              This wallet doesn&rsquo;t hold a HoodFi name yet. You need one to publish —
              the name is what serves the site.
            </p>
            <a className="btn btn-lime btn-lg mt-6" href={MINT_URL}>
              Get a name <ArrowNE />
            </a>
          </div>
        ) : (
          <>
            <section className="shell pt-[clamp(40px,5vw,64px)]">
              <div className="eyebrow">01 / template</div>
              <div className="mt-5">
                <TemplatePicker onSelect={setTemplateId} selected={templateId} />
              </div>
            </section>

            <section className="shell pb-[clamp(48px,6vw,80px)] pt-[clamp(40px,5vw,64px)]">
              <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
                <div className="min-w-0">
                  <div className="eyebrow">02 / content</div>
                  <div className="mt-6">
                    <SiteForm data={data} onChange={update} />
                  </div>
                </div>

                {/* Sticks beside the form on a wide screen, so the page being edited is
                    never scrolled off. Below `lg` it sits under the form instead —
                    a sticky preview on a phone would eat the viewport it needs. */}
                <div className="min-w-0 lg:sticky lg:top-[84px]">
                  <SitePreview html={html} label={data.label || name?.label || "yourname"} />
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <span className="data text-[11.5px] text-[var(--faint)]">
                      {sizeKb} KB · one file · fonts embedded
                    </span>
                    <span className="data text-[11.5px] text-[var(--faint)]">
                      {edited ? "Draft saved" : "Not edited yet"}
                    </span>
                  </div>
                  {name ? (
                    <div className="mt-6">
                      <PublishPanel html={html} name={name} templateId={templateId} />
                    </div>
                  ) : null}
                </div>
              </div>
            </section>
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
