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
import { NamePicker } from "@/components/NamePicker";

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

  // The fields typed in by hand. Everything else is still following the name's records,
  // and must keep following them — see the note on Draft.touched.
  const [touched, setTouched] = useState<Set<keyof SiteData>>(new Set());

  const { prefill } = useNameRecords(name?.node);

  // Honour ?name= from the homepage panel before falling back to the first entry.
  //
  // The list is sorted alphabetically, so "pick the first" silently meant gm whenever
  // someone had chosen test1000 — they clicked one name and landed on another's editor,
  // which reads as the app losing their data rather than as a routing bug.
  useEffect(() => {
    if (names.length === 0) return;
    if (!name) {
      const wanted = new URLSearchParams(window.location.search).get("name");
      // By path. On the label, `?name=crypto` matches BOTH crypto.hoodfi.eth and
      // crypto.gm.hoodfi.eth and takes whichever sorted first — so the editor could open,
      // and then charge for, a different name than the one that was clicked.
      const match = wanted ? names.find((n) => n.path === wanted) : undefined;
      setName(match ?? names[0]);
      return;
    }
    if (!names.some((n) => n.node === name.node)) setName(null);
  }, [names, name]);

  // Load whatever exists for this name: a saved draft first, then the chain records,
  // then nothing. A draft always wins — it is the newer edit by definition.
  useEffect(() => {
    if (!name || loadedFor.current === name.node) return;
    loadedFor.current = name.node;

    const draft = loadDraft(name.node);
    if (draft) {
      setTemplateId(draft.templateId);
      setData({ ...draft.data, label: name.path });
      setEdited(draft.edited);
      setTouched(new Set(draft.touched ?? []));
      return;
    }
    setData({ ...EMPTY_SITE, label: name.path });
    setEdited(false);
    setTouched(new Set());
  }, [name]);

  // Records arrive after the draft check, and they own every field nobody has typed in —
  // not merely every field that is empty. Filling only the empty ones is what left a
  // changed avatar showing the previous picture: the field had a value, so it was skipped
  // forever, and the editor disagreed with /manage with no way to reconcile it.
  //
  // An empty record still never wipes anything. "You have no avatar record" is also what
  // a half-failed read looks like, and losing a picture to it would be unforgivable.
  useEffect(() => {
    if (!name || !prefill) return;
    setData((current) => {
      const next = { ...current };
      let changed = false;
      for (const [k, v] of Object.entries(prefill)) {
        const key = k as keyof SiteData;
        if (key === "links" || key === "label") continue;
        if (touched.has(key) || !v || next[key] === v) continue;
        (next as Record<string, unknown>)[key] = v;
        changed = true;
      }
      return changed ? next : current;
    });
  }, [prefill, name, touched]);

  // Autosave. Cheap, and it is the whole reason a wallet round trip on a phone does not
  // destroy the work.
  useEffect(() => {
    if (!name || !edited) return;
    const t = setTimeout(
      () => saveDraft(name.node, { templateId, data, edited, touched: [...touched] }),
      400
    );
    return () => clearTimeout(t);
  }, [name, templateId, data, edited, touched]);

  // Which keys actually changed, rather than "something changed somewhere". The form
  // hands back a whole SiteData, so the diff is the only place that knows.
  const update = (next: SiteData) => {
    setData((current) => {
      const hit = (Object.keys(next) as (keyof SiteData)[]).filter((k) => next[k] !== current[k]);
      if (hit.length) setTouched((t) => new Set([...t, ...hit]));
      return next;
    });
    setEdited(true);
  };

  const template = TEMPLATES_BY_ID[templateId];

  // The headline stands in as visibly UNSET rather than falling back to the label. A
  // preview that quietly shows your label reads as a finished page, and the one line most
  // worth choosing gets chosen by the software. `blocked` below keeps this string from
  // ever reaching a pin.
  const html = useMemo(
    () =>
      template.render({
        ...data,
        label: data.label || name?.path || "yourname",
        displayName: data.displayName.trim() || "Your headline",
      }),
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
                      {name.path}
                      <span className="opacity-45">.hoodfi.eth</span>
                    </>
                  ) : (
                    "Build a site"
                  )}
                </h1>
              </div>

              {names.length > 1 ? (
                // Capped so a wallet holding many names cannot push the editor itself off
                // the screen; the rows scroll inside it.
                <NamePicker
                  className="w-full max-w-[520px]"
                  names={names}
                  onSelect={setName}
                  selectedNode={name?.node}
                  suffix={false}
                  tone="lime"
                />
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
                  <SitePreview
                    html={html}
                    instantKey={templateId}
                    label={data.label || name?.path || "yourname"}
                  />
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
                      <PublishPanel
                        displayName={data.displayName}
                        html={html}
                        name={name}
                        templateId={templateId}
                      />
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
