"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { Field, Group } from "./SiteForm";
import { safeImage, safeUrl, shortAddress } from "@/lib/templates/html.ts";
import {
  ACCENTS,
  FONTS,
  MAX_BIO,
  MAX_BLOCKS,
  PRESETS,
  allFontFaces,
  background,
  buttonDecl,
  embedOf,
  formEndpoint,
  isEthAddress,
  resolveLook,
  tipAmounts,
} from "@/lib/templates/links.ts";
import type { LinkBlock, LinkBlockType, LinksLook, SiteData } from "@/lib/templates/index.ts";

type Props = {
  data: SiteData;
  onChange: (next: SiteData) => void;
};

const TYPES: Record<LinkBlockType, { name: string; titlePh: string; urlPh?: string }> = {
  link: { name: "Link", titlePh: "Button text", urlPh: "example.com/page" },
  header: { name: "Header", titlePh: "Section heading" },
  embed: { name: "Video / music", titlePh: "Caption (optional)", urlPh: "Paste a YouTube, Spotify or SoundCloud link" },
  image: { name: "Image", titlePh: "Caption (optional)", urlPh: "https://… or ipfs://…" },
  tip: { name: "Tip jar", titlePh: "Tip jar", urlPh: "0x…" },
  email: { name: "Email signup", titlePh: "Hear it first", urlPh: "https://formspree.io/f/…" },
};

const ADD: LinkBlockType[] = ["link", "header", "embed", "image", "tip", "email"];

const SOCIALS: { key: keyof SiteData; label: string; ph: string }[] = [
  { key: "x", label: "X", ph: "@handle" },
  { key: "instagram", label: "Instagram", ph: "username" },
  { key: "tiktok", label: "TikTok", ph: "@handle" },
  { key: "youtube", label: "YouTube", ph: "@channel" },
  { key: "farcaster", label: "Farcaster", ph: "username" },
  { key: "github", label: "GitHub", ph: "username" },
  { key: "telegram", label: "Telegram", ph: "username" },
  { key: "discord", label: "Discord invite", ph: "invite code" },
  { key: "website", label: "Website", ph: "example.com" },
  { key: "email", label: "Email", ph: "you@domain.com" },
];

/** Not a UUID: it only has to be unique within one page, and it ends up in an element id. */
function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function blank(type: LinkBlockType): LinkBlock {
  const base = { id: newId(), title: "", url: "", visible: true };
  switch (type) {
    case "link":
      return { ...base, type, featured: false };
    case "tip":
      // url left empty on purpose: an empty tip address means "the name's own ETH
      // address", which keeps following the addr record if that changes.
      return { ...base, type, title: "Tip jar", amounts: "0.001, 0.005, 0.01" };
    case "email":
      return { ...base, type, button: "Subscribe" };
    default:
      return { ...base, type };
  }
}

/** kebab-case declarations, as the renderer emits them, into a React style object. */
function toStyle(decl: Record<string, string>): CSSProperties {
  return Object.fromEntries(
    Object.entries(decl).map(([k, v]) => [k.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()), v])
  ) as CSSProperties;
}

function Seg<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div aria-label={label} className="flex border border-[var(--line)]" role="group">
      {options.map(([id, text], i) => (
        <button
          aria-pressed={id === value}
          className={`data h-10 flex-1 cursor-pointer px-2.5 text-[11px] uppercase tracking-[0.14em] transition-colors ${
            i < options.length - 1 ? "border-r border-[var(--line)]" : ""
          } ${id === value ? "bg-[var(--ink)] text-[var(--paper)]" : "hover:bg-[var(--hover-fill)]"}`}
          key={id}
          onClick={() => onChange(id)}
          type="button"
        >
          {text}
        </button>
      ))}
    </div>
  );
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      aria-pressed={on}
      className={`data h-8 cursor-pointer whitespace-nowrap border px-3 text-[11px] uppercase tracking-[0.12em] transition-colors ${
        on
          ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]"
          : "border-[var(--line-card)] hover:border-[var(--ink)]"
      }`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

/** Said at the field, the moment it applies: this will not appear on the page. */
function Problem({ children }: { children: React.ReactNode }) {
  return <p className="data text-[11.5px] leading-[1.6] text-[var(--bad)]">{children}</p>;
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="data text-[11.5px] leading-[1.6] text-[var(--faint)]">{children}</p>;
}

const small = "input !h-[42px] !text-[14px]";

/**
 * The Links editor: Content and Appearance, as two tabs.
 *
 * Tabs here and not in SiteForm because this form is three times as long — two dozen
 * blocks plus seven appearance controls in one scroll pushes the look controls so far
 * down that nobody finds them. The preview beside it shows both halves at once, so
 * nothing is hidden that matters.
 */
export function LinksForm({ data, onChange }: Props) {
  const [tab, setTab] = useState<"content" | "appearance">("content");
  const L = resolveLook(data.look);
  // Read back through resolveLook, so a draft from before a field existed — or one with a
  // value this version no longer offers — edits from what is actually on the page.
  const look: LinksLook = {
    preset: L.preset,
    mode: L.mode,
    accent: L.accent,
    font: L.font,
    shape: L.shape,
    bg: L.bg,
    badge: L.badge,
  };
  const blocks = data.blocks ?? [];

  const set = <K extends keyof SiteData>(key: K, value: SiteData[K]) => onChange({ ...data, [key]: value });
  const setLook = <K extends keyof LinksLook>(key: K, value: LinksLook[K]) =>
    onChange({ ...data, look: { ...look, [key]: value } });

  const setBlocks = (next: LinkBlock[]) => onChange({ ...data, blocks: next });
  const patch = (i: number, p: Partial<LinkBlock>) =>
    setBlocks(blocks.map((b, j) => (j === i ? ({ ...b, ...p } as LinkBlock) : b)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= blocks.length) return;
    const next = blocks.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setBlocks(next);
  };
  const add = (type: LinkBlockType) => {
    if (blocks.length >= MAX_BLOCKS) return;
    setBlocks([...blocks, blank(type)]);
  };

  // Every face the picker offers, from the same embedded data the page uses. Drawing each
  // "Aa" in its real face costs no request, and the sample cannot be a different cut from
  // the one that ships.
  const faces = useMemo(() => allFontFaces(), []);

  const tabs = (
    <Seg
      label="Editor section"
      onChange={setTab}
      options={[
        ["content", "Content"],
        ["appearance", "Appearance"],
      ]}
      value={tab}
    />
  );

  if (tab === "appearance") {
    return (
      <div className="grid gap-7">
        {tabs}
        <style dangerouslySetInnerHTML={{ __html: faces }} />

        <Group title="Accent">
          <div className="grid grid-cols-6 gap-2">
            {(Object.keys(ACCENTS) as LinksLook["accent"][]).map((id) => {
              const sel = id === look.accent;
              return (
                <button
                  aria-pressed={sel}
                  className="cursor-pointer text-left"
                  key={id}
                  onClick={() => setLook("accent", id)}
                  type="button"
                >
                  <span
                    className="block h-11"
                    style={{
                      background: ACCENTS[id].hex,
                      boxShadow: sel ? "0 0 0 2px var(--paper), 0 0 0 4px var(--ink)" : "inset 0 0 0 1px rgba(11,14,8,.12)",
                    }}
                  />
                  <span
                    className={`data mt-2 block truncate text-[10.5px] uppercase tracking-[0.08em] ${
                      sel ? "font-semibold text-[var(--fg)]" : "text-[var(--label)]"
                    }`}
                  >
                    {ACCENTS[id].name}
                  </span>
                </button>
              );
            })}
          </div>
        </Group>

        <Group title="Theme">
          <div className="grid grid-cols-3 gap-2">
            {PRESETS.map((p) => {
              const sel = p.id === look.preset;
              const R = resolveLook({ ...look, preset: p.id });
              const bar = (featured: boolean): CSSProperties => ({
                ...toStyle(buttonDecl(R, p.id, featured)),
                height: 14,
                ...(p.id === "brutal"
                  ? { borderWidth: 1.5, boxShadow: `2px 2px 0 ${featured ? R.m.fg : R.a.hex}` }
                  : p.id === "outline"
                    ? { borderWidth: 1.5 }
                    : {}),
              });
              return (
                <button
                  aria-pressed={sel}
                  className={`cursor-pointer border text-left transition-colors ${
                    sel ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]" : "border-[var(--line)] hover:border-[var(--ink)]"
                  }`}
                  key={p.id}
                  onClick={() => setLook("preset", p.id)}
                  type="button"
                >
                  <span className="flex flex-col gap-1.5 px-3 pb-2.5 pt-3" style={{ background: background(R) }}>
                    <span style={bar(true)} />
                    <span style={bar(false)} />
                    <span style={bar(false)} />
                  </span>
                  <span className="flex items-center justify-between gap-1.5 px-2.5 py-2">
                    <span className="text-[13px] font-bold tracking-[-0.01em]">{p.name}</span>
                    <span className={`block h-2 w-2 ${sel ? "bg-[var(--lime)]" : ""}`} />
                  </span>
                </button>
              );
            })}
          </div>
        </Group>

        <Group title="Mode">
          <Seg
            label="Mode"
            onChange={(v) => setLook("mode", v)}
            options={[
              ["dark", "Dark"],
              ["light", "Light"],
            ]}
            value={look.mode}
          />
        </Group>

        <Group title="Font">
          <div className="grid grid-cols-3 gap-2">
            {FONTS.map((f) => {
              const sel = f.id === look.font;
              return (
                <button
                  aria-pressed={sel}
                  className={`cursor-pointer border px-3 py-3.5 text-left transition-colors ${
                    sel ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]" : "border-[var(--line)] hover:border-[var(--ink)]"
                  }`}
                  key={f.id}
                  onClick={() => setLook("font", f.id)}
                  type="button"
                >
                  <span
                    className="block leading-none"
                    style={{
                      fontFamily: `'${f.display.family}', sans-serif`,
                      fontWeight: f.weight,
                      fontSize: f.id === "serif" ? 34 : 28,
                      letterSpacing: f.tracking,
                    }}
                  >
                    Aa
                  </span>
                  <span className="data mt-1.5 block truncate text-[10.5px] uppercase tracking-[0.08em] opacity-70">
                    {f.name}
                  </span>
                </button>
              );
            })}
          </div>
        </Group>

        <Group title="Buttons and ground">
          <div className="grid gap-2.5">
            <span className="label">Button shape</span>
            <Seg
              label="Button shape"
              onChange={(v) => setLook("shape", v)}
              options={[
                ["square", "Square"],
                ["rounded", "Rounded"],
                ["pill", "Pill"],
              ]}
              value={look.shape}
            />
          </div>
          <div className="grid gap-2.5">
            <span className="label">Background</span>
            <Seg
              label="Background"
              onChange={(v) => setLook("bg", v)}
              options={[
                ["solid", "Solid"],
                ["glow", "Glow"],
                ["band", "Band"],
                ["grid", "Grid"],
              ]}
              value={look.bg}
            />
          </div>
          <button
            aria-pressed={look.badge}
            className="flex w-full cursor-pointer items-center justify-between gap-3 border border-[var(--line)] p-3.5 text-left hover:border-[var(--ink)]"
            onClick={() => setLook("badge", !look.badge)}
            type="button"
          >
            <span>
              <span className="block text-[14px] font-bold">HoodFi badge</span>
              <span className="data mt-0.5 block text-[11.5px] text-[var(--faint)]">
                A small &ldquo;made on HoodFi Sites&rdquo; line at the foot of the page
              </span>
            </span>
            <span
              className={`relative block h-[22px] w-10 flex-none ${look.badge ? "bg-[var(--ink)]" : "bg-[var(--line)]"}`}
            >
              <span
                className={`absolute top-[3px] block h-4 w-4 transition-[left] ${
                  look.badge ? "left-[21px] bg-[var(--lime)]" : "left-[3px] bg-[var(--paper)]"
                }`}
              />
            </span>
          </button>
        </Group>
      </div>
    );
  }

  const bioLength = data.bio.length;

  return (
    <div className="grid gap-7">
      {tabs}

      <Group title="Profile">
        <Field label="Title" hint="Your name or your project. Publishing needs one.">
          <input
            className="input"
            maxLength={60}
            onChange={(e) => set("displayName", e.target.value)}
            placeholder="Your name or project"
            value={data.displayName}
          />
        </Field>
        <label className="block">
          <span className="label">Bio</span>
          <div className="mt-2.5">
            <textarea
              className="textarea"
              maxLength={Math.max(MAX_BIO, bioLength)}
              onChange={(e) => set("bio", e.target.value)}
              placeholder="A line or two."
              rows={3}
              value={data.bio}
            />
          </div>
          {/* A bio from the description record can be longer than this page wants. It is
              shown in full rather than cut, but said here, where it can be fixed. */}
          <p
            className={`data mt-2 text-[11.5px] ${bioLength > MAX_BIO ? "text-[var(--bad)]" : "text-[var(--faint)]"}`}
          >
            {bioLength} / {MAX_BIO}
            {bioLength > MAX_BIO ? " — long bios push your buttons below the fold" : ""}
          </p>
        </label>
        <Field
          label="Picture"
          hint="https or ipfs://. Blank shows your initial on the accent. Your avatar record fills this in automatically."
        >
          <input
            className="input"
            maxLength={300}
            onChange={(e) => set("avatar", e.target.value)}
            placeholder="https://… or ipfs://…"
            spellCheck={false}
            value={data.avatar}
          />
        </Field>
      </Group>

      <section className="border-t border-[var(--line)] pt-7">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="data text-[11.5px] uppercase tracking-[0.2em] text-[var(--label)]">Blocks</h3>
          <span className="data text-[11.5px] text-[var(--faint)]">
            {blocks.length} / {MAX_BLOCKS}
          </span>
        </div>

        <div className="mt-5 grid gap-2.5">
          {blocks.length === 0 ? (
            <p className="border border-dashed border-[var(--line)] p-5 text-[13.5px] leading-[1.6] text-[var(--dim)]">
              Nothing here yet. Start with a link — the first one is usually the thing you
              most want people to click, so try marking it Featured.
            </p>
          ) : null}
          {blocks.map((b, i) => (
            <BlockCard
              block={b}
              ethAddress={data.ethAddress}
              first={i === 0}
              index={i}
              key={b.id}
              last={i === blocks.length - 1}
              onMove={(d) => move(i, d)}
              onPatch={(p) => patch(i, p)}
              onRemove={() => setBlocks(blocks.filter((_, j) => j !== i))}
            />
          ))}
        </div>

        <div className="mt-4">
          <span className="label">{blocks.length >= MAX_BLOCKS ? `Maximum ${MAX_BLOCKS} blocks` : "Add a block"}</span>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {ADD.map((type) => (
              <button
                className="h-9 cursor-pointer border border-[color-mix(in_srgb,var(--fg)_40%,transparent)] px-3 text-[13px] font-semibold transition-colors hover:border-[var(--fg)] hover:bg-[var(--hover-fill)] disabled:cursor-not-allowed disabled:opacity-40"
                disabled={blocks.length >= MAX_BLOCKS}
                key={type}
                onClick={() => add(type)}
                type="button"
              >
                + {TYPES[type].name}
              </button>
            ))}
          </div>
        </div>
      </section>

      <Group title="Social icons">
        <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(170px,1fr))]">
          {SOCIALS.map((s) => (
            <label className="block" key={s.key}>
              <span className="label">{s.label}</span>
              <input
                className={`${small} mt-2`}
                maxLength={s.key === "website" ? 300 : 80}
                onChange={(e) => set(s.key, e.target.value as never)}
                placeholder={s.ph}
                spellCheck={false}
                type={s.key === "email" ? "email" : "text"}
                value={(data[s.key] as string) ?? ""}
              />
            </label>
          ))}
        </div>
        <div className="grid gap-2.5">
          <span className="label">Position</span>
          <Seg
            label="Social icon position"
            onChange={(v) => set("socialPos", v)}
            options={[
              ["top", "Under bio"],
              ["bottom", "Page footer"],
            ]}
            value={data.socialPos === "bottom" ? "bottom" : "top"}
          />
        </div>
      </Group>
    </div>
  );
}

function BlockCard({
  block: b,
  index,
  first,
  last,
  ethAddress,
  onPatch,
  onMove,
  onRemove,
}: {
  block: LinkBlock;
  index: number;
  first: boolean;
  last: boolean;
  ethAddress: string;
  onPatch: (p: Partial<LinkBlock>) => void;
  onMove: (d: -1 | 1) => void;
  onRemove: () => void;
}) {
  const t = TYPES[b.type];
  const featured = b.type === "link" && b.featured;
  const num = String(index + 1).padStart(2, "0");
  const ctrl =
    "data h-7 cursor-pointer border border-[var(--line-card)] bg-transparent text-[12px] transition-colors hover:border-[var(--ink)] disabled:cursor-default disabled:opacity-30 disabled:hover:border-[var(--line-card)]";

  return (
    <div
      className={`border p-3.5 ${featured ? "border-[var(--ink)] bg-[var(--paper-alt)]" : "border-[var(--line)]"} ${
        b.visible ? "" : "opacity-50"
      }`}
    >
      <div className="flex items-center justify-between gap-2.5">
        <span className="data truncate text-[10.5px] uppercase tracking-[0.18em] text-[var(--faint)]">
          {num} · {t.name}
          {b.visible ? "" : " · hidden"}
        </span>
        <div className="flex flex-none items-center gap-1">
          <button aria-label={`Move block ${index + 1} up`} className={`${ctrl} w-7`} disabled={first} onClick={() => onMove(-1)} type="button">
            ↑
          </button>
          <button aria-label={`Move block ${index + 1} down`} className={`${ctrl} w-7`} disabled={last} onClick={() => onMove(1)} type="button">
            ↓
          </button>
          <button
            className={`${ctrl} px-2 text-[10.5px] uppercase tracking-[0.12em]`}
            onClick={() => onPatch({ visible: !b.visible })}
            type="button"
          >
            {b.visible ? "Hide" : "Show"}
          </button>
          <button
            aria-label={`Remove block ${index + 1}`}
            className="data h-7 cursor-pointer px-1.5 text-[10.5px] uppercase tracking-[0.12em] text-[var(--faint)] underline underline-offset-4 transition-colors hover:text-[var(--bad)]"
            onClick={onRemove}
            type="button"
          >
            Remove
          </button>
        </div>
      </div>

      <div className="mt-3 grid gap-2">
        <input
          aria-label={`Block ${index + 1} ${b.type === "link" ? "button text" : "title"}`}
          className={small}
          maxLength={60}
          onChange={(e) => onPatch({ title: e.target.value })}
          placeholder={t.titlePh}
          value={b.title}
        />
        <BlockFields b={b} ethAddress={ethAddress} index={index} onPatch={onPatch} />
      </div>
    </div>
  );
}

function BlockFields({
  b,
  index,
  ethAddress,
  onPatch,
}: {
  b: LinkBlock;
  index: number;
  ethAddress: string;
  onPatch: (p: Partial<LinkBlock>) => void;
}) {
  const t = TYPES[b.type];
  const url = b.url ?? "";
  const urlInput = (placeholder = t.urlPh ?? "") => (
    <input
      aria-label={`Block ${index + 1} address`}
      className={small}
      maxLength={300}
      onChange={(e) => onPatch({ url: e.target.value })}
      placeholder={placeholder}
      spellCheck={false}
      value={url}
    />
  );

  switch (b.type) {
    case "header":
      return null;

    case "link": {
      const bad = url.trim() !== "" && !safeUrl(url);
      const thumbOn = typeof b.thumb === "string";
      const thumbBad = thumbOn && b.thumb!.trim() !== "" && !safeImage(b.thumb!);
      return (
        <>
          {urlInput()}
          {bad ? <Problem>Not a web address, so this button won&rsquo;t appear.</Problem> : null}
          {url.trim() === "" ? <Note>Needs an address before it shows on the page.</Note> : null}
          <div className="flex flex-wrap gap-1.5">
            <Toggle on={b.featured} onClick={() => onPatch({ featured: !b.featured })}>
              ★ Featured
            </Toggle>
            <Toggle on={thumbOn} onClick={() => onPatch({ thumb: thumbOn ? undefined : "" })}>
              Thumbnail
            </Toggle>
          </div>
          {thumbOn ? (
            <>
              <input
                aria-label={`Block ${index + 1} thumbnail`}
                className={small}
                maxLength={300}
                onChange={(e) => onPatch({ thumb: e.target.value })}
                placeholder="Thumbnail image — https://… or ipfs://…"
                spellCheck={false}
                value={b.thumb}
              />
              {thumbBad ? <Problem>Not an https or ipfs:// image.</Problem> : null}
            </>
          ) : null}
        </>
      );
    }

    case "embed": {
      const e = embedOf(url);
      return (
        <>
          {urlInput()}
          {url.trim() === "" ? null : e ? (
            <Note>{e.provider} player</Note>
          ) : (
            <Problem>Not a YouTube video, Spotify link or SoundCloud track, so nothing will show.</Problem>
          )}
        </>
      );
    }

    case "image": {
      const bad = url.trim() !== "" && !safeImage(url);
      return (
        <>
          {urlInput()}
          {bad ? <Problem>Not an https or ipfs:// image, so it won&rsquo;t appear.</Problem> : null}
        </>
      );
    }

    case "tip": {
      const to = url.trim() || ethAddress.trim();
      const amounts = tipAmounts(b.amounts);
      return (
        <>
          {urlInput(ethAddress ? `Your addr record — ${shortAddress(ethAddress)}` : "0x… address to receive tips")}
          {!to ? (
            <Problem>Needs an address. Set an ETH addr record on your name or paste one here.</Problem>
          ) : !isEthAddress(to) ? (
            <Problem>Not a 0x address, so the tip jar won&rsquo;t appear.</Problem>
          ) : null}
          <input
            aria-label={`Block ${index + 1} amounts`}
            className={small}
            maxLength={60}
            onChange={(e) => onPatch({ amounts: e.target.value })}
            placeholder="0.001, 0.005, 0.01"
            spellCheck={false}
            value={b.amounts}
          />
          {amounts.length === 0 ? <Problem>Add at least one amount.</Problem> : null}
          <Note>Amounts in ETH, comma-separated, first three shown. Tips go straight to the address on Robinhood Chain — nothing passes through us.</Note>
        </>
      );
    }

    case "email": {
      const bad = url.trim() !== "" && !formEndpoint(url);
      return (
        <>
          {urlInput()}
          {bad ? <Problem>Must be an https:// address, so this form won&rsquo;t appear.</Problem> : null}
          <input
            aria-label={`Block ${index + 1} button label`}
            className={small}
            maxLength={20}
            onChange={(e) => onPatch({ button: e.target.value })}
            placeholder="Button label"
            value={b.button}
          />
          <Note>
            Your site is a static file, so signups post to a form endpoint you own — Formspree,
            Buttondown, ConvertKit. It stays hidden until one is set.
          </Note>
        </>
      );
    }
  }
}
