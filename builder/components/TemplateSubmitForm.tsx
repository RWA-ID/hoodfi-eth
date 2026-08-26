"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowNE } from "./ArrowNE";
import { useCollectionCheck } from "./useCollectionCheck";
import { PARTNER_URL } from "@/lib/site";

type Status = "idle" | "sending" | "sent";

/** Mirrors the worker's caps so the browser refuses first and nobody loses a draft. */
const MAX = {
  name: 80,
  email: 160,
  org: 100,
  website: 200,
  x: 60,
  collection: 60,
  opensea: 200,
  payee: 60,
  cover: 300,
  message: 2000,
} as const;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      {/* "(optional)" folded into the label string: `.label` is unlayered and uppercases
          its content, which beats a normal-case utility on a nested span — a hint set
          beside it renders as a second shouted word and reads like part of the name. */}
      <span className="label">{label}</span>
      <div className="mt-2.5">{children}</div>
    </label>
  );
}

export function TemplateSubmitForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [collection, setCollection] = useState("");
  const check = useCollectionCheck(collection);

  /**
   * When the form became interactive, on the monotonic clock.
   *
   * What gets sent is the *difference*, never the reading. The worker's bot check wants
   * to know how long the form was open, and deriving that from two clocks — the
   * visitor's and Cloudflare's — makes any skew between them count as elapsed time. A
   * phone running a few seconds fast would then have every submission rejected forever.
   */
  const mountedAt = useRef(0);

  /**
   * Whether the React submit handler is attached yet.
   *
   * Load-bearing. Until this hydrates there is no onSubmit to preventDefault, so
   * pressing the button performs the browser's native submit — a GET, which would put
   * the sender's name, email and payout address into the query string, the address bar
   * and their history. The button ships disabled and is enabled by the same event that
   * makes it work.
   */
  const [ready, setReady] = useState(false);
  useEffect(() => {
    mountedAt.current = performance.now();
    setReady(true);
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "sending") return;

    const data = new FormData(event.currentTarget);
    setError(null);
    setStatus("sending");

    try {
      const response = await fetch(PARTNER_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          email: data.get("email"),
          org: data.get("org"),
          website: data.get("website"),
          x: data.get("x"),
          message: data.get("message"),
          collection: data.get("collection"),
          opensea: data.get("opensea"),
          payee: data.get("payee"),
          cover: data.get("cover"),
          topic: "template",
          hp: data.get("company_url"),
          t: Math.round(performance.now() - mountedAt.current),
        }),
      });

      if (!response.ok) {
        // The worker's 4xx bodies are written for the person who typed the form.
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        setError(body?.message ?? "That didn't send. Please try again.");
        setStatus("idle");
        return;
      }
      setStatus("sent");
    } catch {
      setError("That didn't send — check your connection and try again.");
      setStatus("idle");
    }
  }

  if (status === "sent") {
    return (
      <div className="panel shadow-card p-8 sm:p-10">
        <div className="chip-square" />
        <h3 className="h-sub mt-5">That&rsquo;s with us.</h3>
        <p className="lede mt-3.5 max-w-[46ch]">
          We review every submission by hand and reply from a real address. If your
          collection checks out we&rsquo;ll come back with what the template needs and how
          the payouts work.
        </p>
        <p className="data mt-6 text-[11.5px] leading-[1.7] text-[var(--faint)]">
          No confirmation email is sent — this form only ever delivers to us, which is
          what keeps it from being usable as a relay.
        </p>
      </div>
    );
  }

  return (
    <form className="panel shadow-card p-7 sm:p-9" onSubmit={handleSubmit} noValidate>
      {/* Honeypot. Hidden and off the tab order; a real browser never fills it. */}
      <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label>
          Company URL
          <input name="company_url" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Your name">
          <input className="input" name="name" maxLength={MAX.name} required />
        </Field>
        <Field label="Email">
          <input className="input" name="email" type="email" maxLength={MAX.email} required />
        </Field>
        <Field label="Project">
          <input className="input" name="org" maxLength={MAX.org} required />
        </Field>
        <Field label="Project website">
          <input
            className="input"
            name="website"
            maxLength={MAX.website}
            placeholder="https://…"
            spellCheck={false}
            required
          />
        </Field>
      </div>

      {/* Both required, and the reason is the whole review. A template is accepted from
          outside and then served under a hoodfi.eth subdomain, so the one thing we have
          to establish is that the sender speaks for the collection — not merely that the
          contract they typed exists, which anyone can read off a marketplace. The site
          and the X account are what we check the submission against and where we reply
          to confirm it; without either there is nothing to confirm against, and an
          approval would rest on the sender's own word. */}
      <div className="mt-5">
        <Field label="Owner's X account">
          <input
            className="input"
            name="x"
            maxLength={MAX.x}
            placeholder="@yourcollection"
            spellCheck={false}
            autoComplete="off"
            required
          />
        </Field>
        <p className="data mt-2.5 text-[11.5px] leading-[1.7] text-[var(--faint)]">
          The collection&rsquo;s own account — the one linked from your OpenSea page, not a
          personal one. We reply there from @hoodfieth to confirm the submission before any
          template is approved, so it has to be an account that can answer for the project.
        </p>
      </div>

      <div className="mt-5">
        <Field label="Collection contract on Robinhood Chain">
          <input
            className="input data"
            name="collection"
            maxLength={MAX.collection}
            placeholder="0x…"
            spellCheck={false}
            autoComplete="off"
            value={collection}
            onChange={(e) => setCollection(e.target.value)}
            required
          />
        </Field>

        {/* Reserve the row's height in every state. This block sits mid-form and a line
            that appears and disappears as you type shifts every field below it. */}
        <div className="mt-2.5 min-h-[42px]">
          {check.status === "checking" ? (
            <p className="data text-[12px] text-[var(--faint)]">Reading Robinhood Chain…</p>
          ) : null}
          {check.status === "ok" ? (
            <p className="data text-[12px] leading-[1.6] text-[var(--ok)]">
              ✓ {check.info.name}
              {check.info.symbol ? ` (${check.info.symbol})` : ""}
              {check.info.supply ? ` · ${check.info.supply} minted` : ""}
            </p>
          ) : null}
          {check.status === "invalid" ? (
            <p className="data text-[12px] leading-[1.6] text-[var(--bad)]">{check.reason}</p>
          ) : null}
          {/* Never phrased as "not a valid collection" — a read that did not happen is
              not a read that returned no. */}
          {check.status === "unreachable" ? (
            <p className="data text-[12px] leading-[1.6] text-[var(--warn)]">
              Couldn&rsquo;t reach the chain to check this. Send it anyway — we verify by
              hand.
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <Field label="OpenSea collection link">
          <input
            className="input"
            name="opensea"
            maxLength={MAX.opensea}
            placeholder="https://opensea.io/collection/…"
            spellCheck={false}
            required
          />
        </Field>
        <Field label="Payout address">
          <input
            className="input data"
            name="payee"
            maxLength={MAX.payee}
            placeholder="0x…"
            spellCheck={false}
            autoComplete="off"
            required
          />
        </Field>
      </div>

      <div className="mt-5">
        <Field label="Cover art link">
          <input
            className="input"
            name="cover"
            maxLength={MAX.cover}
            placeholder="Link to a 1600×1000 PNG or JPG"
            spellCheck={false}
            required
          />
        </Field>
        <p className="data mt-2.5 text-[11.5px] leading-[1.7] text-[var(--faint)]">
          This is the image holders see in the template picker. 1600×1000, PNG or JPG —
          a link is fine (Drive, Dropbox, IPFS, anywhere we can fetch it). Not WebP: the
          share-card renderer can&rsquo;t decode it, so a WebP cover reaches every social
          preview as an empty box.
        </p>
      </div>

      <div className="mt-5">
        <Field label="The design you have in mind">
          {/* `.textarea`, not `.input` — globals.css is unlayered, so an `h-auto` utility
              on a `.input` textarea loses to its fixed 48px height. */}
          <textarea
            className="textarea"
            name="message"
            rows={6}
            maxLength={MAX.message}
            placeholder="What the template should look like, links to references, and anything your holders would expect to see on it."
            required
          />
        </Field>
      </div>

      {error ? <p className="mt-5 text-[14px] leading-[1.6] text-[var(--bad)]">{error}</p> : null}

      <button
        className="btn btn-ink btn-lg mt-7 w-full sm:w-auto"
        disabled={!ready || status === "sending"}
        type="submit"
      >
        {status === "sending" ? "Sending…" : "Submit your collection"}
        {status === "sending" ? null : <ArrowNE />}
      </button>

      <p className="data mt-5 text-[11.5px] leading-[1.7] text-[var(--faint)]">
        We only accept collections verified on OpenSea, we confirm every submission with
        the collection&rsquo;s own X account before approving it, and every template is
        reviewed and built by us before it goes live.
      </p>
    </form>
  );
}
