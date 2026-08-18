"use client";

import type { SiteData, SiteLink } from "@/lib/templates/index.ts";

type Props = {
  data: SiteData;
  onChange: (next: SiteData) => void;
};

/** Caps that keep a template's layout inside the shape it was designed for. */
const MAX = {
  displayName: 60,
  tagline: 140,
  bio: 1200,
  label: 40,
  url: 300,
  handle: 60,
  address: 120,
} as const;

const MAX_LINKS = 8;

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <div className="mt-2.5">{children}</div>
      {hint ? (
        <p className="data mt-2 text-[11.5px] leading-[1.6] text-[var(--faint)]">{hint}</p>
      ) : null}
    </label>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-[var(--line)] pt-7">
      <h3 className="data text-[11.5px] uppercase tracking-[0.2em] text-[var(--label)]">
        {title}
      </h3>
      <div className="mt-5 grid gap-5">{children}</div>
    </section>
  );
}

/**
 * Everything a site is made of, in one scroll.
 *
 * Not a wizard. A wizard hides what you have already written behind a Back button, and
 * this form is short enough that hiding two thirds of it to show a progress bar would
 * cost more than it saves. Every keystroke re-renders the preview, so the page beside
 * this one is the progress indicator.
 */
export function SiteForm({ data, onChange }: Props) {
  const set = <K extends keyof SiteData>(key: K, value: SiteData[K]) =>
    onChange({ ...data, [key]: value });

  const setLink = (i: number, patch: Partial<SiteLink>) => {
    const links = data.links.map((l, idx) => (idx === i ? { ...l, ...patch } : l));
    onChange({ ...data, links });
  };

  const addLink = () => {
    if (data.links.length >= MAX_LINKS) return;
    onChange({ ...data, links: [...data.links, { label: "", url: "" }] });
  };

  const removeLink = (i: number) =>
    onChange({ ...data, links: data.links.filter((_, idx) => idx !== i) });

  return (
    <div className="grid gap-7">
      <Group title="Identity">
        <Field label="Name" hint="Shown big at the top. Defaults to your HoodFi label.">
          <input
            className="input"
            maxLength={MAX.displayName}
            onChange={(e) => set("displayName", e.target.value)}
            placeholder={data.label}
            value={data.displayName}
          />
        </Field>
        <Field label="Tagline">
          <input
            className="input"
            maxLength={MAX.tagline}
            onChange={(e) => set("tagline", e.target.value)}
            placeholder="One line about you"
            value={data.tagline}
          />
        </Field>
        <Field
          label="Picture"
          hint="An https or ipfs:// address. Your avatar record is filled in automatically if you have one."
        >
          <input
            className="input"
            maxLength={MAX.url}
            onChange={(e) => set("avatar", e.target.value)}
            placeholder="https://… or ipfs://…"
            spellCheck={false}
            value={data.avatar}
          />
        </Field>
        <Field label="Bio" hint="Blank lines start a new paragraph.">
          {/* `.textarea`, not `.input` — globals.css is unlayered, so a `h-auto` utility
              on a `.input` textarea loses to its fixed 48px height. */}
          <textarea
            className="textarea"
            maxLength={MAX.bio}
            onChange={(e) => set("bio", e.target.value)}
            placeholder="A paragraph or two."
            rows={5}
            value={data.bio}
          />
        </Field>
      </Group>

      <Group title="Links">
        {/* Each link is its own block with the control in its header rather than a
            third column. At the 420px the form column actually gets, a
            label + url + button row wraps the button onto its own line and every link
            costs three rows — which made eight links an unreadable wall. */}
        {data.links.map((link, i) => (
          <div className="border border-[var(--line)] p-4" key={i}>
            <div className="flex items-center justify-between gap-3">
              <span className="data text-[10.5px] uppercase tracking-[0.18em] text-[var(--faint)]">
                Link {String(i + 1).padStart(2, "0")}
              </span>
              <button
                aria-label={`Remove link ${i + 1}`}
                className="data cursor-pointer text-[11px] uppercase tracking-[0.14em] text-[var(--faint)] underline underline-offset-4 transition-colors hover:text-[var(--bad)]"
                onClick={() => removeLink(i)}
                type="button"
              >
                Remove
              </button>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
              <input
                aria-label={`Link ${i + 1} label`}
                className="input"
                maxLength={MAX.label}
                onChange={(e) => setLink(i, { label: e.target.value })}
                placeholder="Newsletter"
                value={link.label}
              />
              <input
                aria-label={`Link ${i + 1} URL`}
                className="input"
                maxLength={MAX.url}
                onChange={(e) => setLink(i, { url: e.target.value })}
                placeholder="example.com/notes"
                spellCheck={false}
                value={link.url}
              />
            </div>
          </div>
        ))}
        <div>
          <button
            className="btn btn-ghost btn-sm"
            disabled={data.links.length >= MAX_LINKS}
            onClick={addLink}
            type="button"
          >
            {data.links.length >= MAX_LINKS ? `Maximum ${MAX_LINKS} links` : "Add a link"}
          </button>
        </div>
      </Group>

      <Group title="Elsewhere">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="X">
            <input
              className="input"
              maxLength={MAX.handle}
              onChange={(e) => set("x", e.target.value)}
              placeholder="@handle"
              spellCheck={false}
              value={data.x}
            />
          </Field>
          <Field label="GitHub">
            <input
              className="input"
              maxLength={MAX.handle}
              onChange={(e) => set("github", e.target.value)}
              placeholder="username"
              spellCheck={false}
              value={data.github}
            />
          </Field>
          <Field label="Telegram">
            <input
              className="input"
              maxLength={MAX.handle}
              onChange={(e) => set("telegram", e.target.value)}
              placeholder="username"
              spellCheck={false}
              value={data.telegram}
            />
          </Field>
          <Field label="Discord invite">
            <input
              className="input"
              maxLength={MAX.handle}
              onChange={(e) => set("discord", e.target.value)}
              placeholder="invite code"
              spellCheck={false}
              value={data.discord}
            />
          </Field>
          <Field label="Website">
            <input
              className="input"
              maxLength={MAX.url}
              onChange={(e) => set("website", e.target.value)}
              placeholder="example.com"
              spellCheck={false}
              value={data.website}
            />
          </Field>
          <Field label="OpenSea">
            <input
              className="input"
              maxLength={MAX.url}
              onChange={(e) => set("opensea", e.target.value)}
              placeholder="https://opensea.io/…"
              spellCheck={false}
              value={data.opensea}
            />
          </Field>
        </div>
      </Group>

      <Group title="Addresses">
        <Field
          label="Ethereum"
          hint="Shown as a copy button, not a link. Your addr record is filled in automatically."
        >
          <input
            className="input data"
            maxLength={MAX.address}
            onChange={(e) => set("ethAddress", e.target.value)}
            placeholder="0x…"
            spellCheck={false}
            value={data.ethAddress}
          />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Bitcoin">
            <input
              className="input data"
              maxLength={MAX.address}
              onChange={(e) => set("btcAddress", e.target.value)}
              placeholder="bc1…"
              spellCheck={false}
              value={data.btcAddress}
            />
          </Field>
          <Field label="Solana">
            <input
              className="input data"
              maxLength={MAX.address}
              onChange={(e) => set("solAddress", e.target.value)}
              placeholder="Base58 address"
              spellCheck={false}
              value={data.solAddress}
            />
          </Field>
        </div>
      </Group>
    </div>
  );
}
