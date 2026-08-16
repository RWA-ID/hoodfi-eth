"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowNE } from "./ArrowNE";
import { track } from "@/lib/analytics";
import { PARTNER_URL } from "@/lib/site";

/**
 * The partner enquiry form.
 *
 * Posts to the gateway, which holds the mail credential and forwards one email. There
 * is no API route to post to instead: the site is a static export served from both a
 * CDN and an IPFS gateway, so anything with a secret in it has to live on the worker.
 *
 * Nothing here is a wallet action. A partner conversation should not require connecting
 * one, and asking for a signature to send an email would be theatre.
 */

const TOPICS = [
  { id: "integration", label: "Integration" },
  { id: "distribution", label: "Distribution" },
  { id: "press", label: "Press" },
  { id: "other", label: "Something else" },
] as const;

type Topic = (typeof TOPICS)[number]["id"];
type Status = "idle" | "sending" | "sent";

/** Mirrors the worker's caps, so the browser refuses first and nobody loses a draft. */
const MAX = { name: 80, email: 160, org: 100, website: 200, message: 2000 } as const;

/**
 * One labelled field.
 *
 * "optional" is folded into the label string rather than set beside it in a lighter
 * style: `.label` is unlayered and uppercases its content, which beats a `normal-case`
 * utility on a nested span — so a sentence-case hint renders as a second shouted word
 * ("COMPANY OPTIONAL") and reads like part of the field name. In parentheses it is
 * unambiguous at the size and weight the design already has.
 */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <div className="mt-2.5">{children}</div>
    </label>
  );
}

export function PartnerForm() {
  const [topic, setTopic] = useState<Topic>("integration");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  /**
   * When the form became interactive, on the monotonic clock.
   *
   * `performance.now()` rather than `Date.now()`, and what gets sent is the *difference*
   * rather than the reading. The worker's bot check needs to know how long the form was
   * open, and deriving that from two clocks — ours and Cloudflare's — means any skew
   * between them counts as elapsed time. A device running a few seconds fast then has
   * every submission rejected. Measured on one monotonic clock there is nothing to skew,
   * and it is immune to the user changing their system time mid-form.
   *
   * Set in an effect, not at module scope: this component is prerendered, and the value
   * has to be the moment this visitor's page came alive.
   */
  const mountedAt = useRef(0);
  /**
   * Whether the React submit handler is attached yet.
   *
   * Load-bearing, not a nicety. Until this component hydrates there is no `onSubmit` to
   * call `preventDefault`, so pressing the button performs the browser's *native* submit
   * — and with no `method` on the form that is a GET, which puts the sender's name,
   * email and entire message into the query string, the address bar and their history.
   * Exactly the data that should never travel in a URL. The button therefore ships
   * disabled and is enabled by hydration, which is the same event that makes it work.
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
          message: data.get("message"),
          topic,
          hp: data.get("company_url"),
          // How long the form was open, not when it opened. See the ref above.
          t: Math.round(performance.now() - mountedAt.current),
        }),
      });

      if (!response.ok) {
        // The worker's 4xx bodies are written to be read by the person who typed the
        // form, so they are shown as-is. Anything else falls back to our own wording.
        const body = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        setError(body?.message ?? "That didn't send. Please try again.");
        setStatus("idle");
        return;
      }

      // `method` rather than `tier`: the worker's blobs are positional and shared
      // across event names, so the slot means whatever the event says it means — but
      // `tier` is clamped to 8 characters and would store "integrat" and "distribu",
      // while `method` has room for the longest topic.
      track("partner_submitted", { method: topic });
      setStatus("sent");
    } catch {
      // A network failure, an offline phone, or a blocked request. Nothing about it is
      // worth surfacing verbatim.
      setError("That didn't send — check your connection and try again.");
      setStatus("idle");
    }
  }

  if (status === "sent") {
    return (
      <div className="panel p-8 sm:p-10">
        <div className="chip-square" />
        <h3 className="h-sub mt-5">That's with us.</h3>
        <p className="lede mt-3.5 max-w-[46ch]">
          We read everything that comes through here and reply from a real address,
          usually within a couple of days. Nothing else is needed from you.
        </p>
        <p className="data mt-6 text-[11.5px] leading-[1.7] text-[var(--faint)]">
          No confirmation email is sent — this form only ever delivers to us, which is
          what keeps it from being usable to mail anybody else.
        </p>
      </div>
    );
  }

  const sending = status === "sending";

  return (
    <form onSubmit={handleSubmit} className="panel p-6 sm:p-9" noValidate>
      {/* Honeypot. Hidden from sight, from the tab order and from autofill, so only a
          script that fills every input it finds will put anything in it. Not
          `display:none` — some bots skip those, and this one wants to be found. */}
      <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="company_url">Company URL</label>
        <input
          id="company_url"
          name="company_url"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <fieldset className="m-0 border-none p-0">
        <legend className="label">What's this about</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {TOPICS.map((option) => {
            const active = option.id === topic;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setTopic(option.id)}
                aria-pressed={active}
                className={`btn btn-sm ${active ? "btn-ink" : "btn-ghost"}`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <Field label="Your name">
          <input
            name="name"
            type="text"
            required
            maxLength={MAX.name}
            autoComplete="name"
            className="input"
            placeholder="Alex Chen"
          />
        </Field>
        <Field label="Email">
          <input
            name="email"
            type="email"
            required
            maxLength={MAX.email}
            autoComplete="email"
            className="input"
            placeholder="alex@company.com"
          />
        </Field>
        <Field label="Company (optional)">
          <input
            name="org"
            type="text"
            maxLength={MAX.org}
            autoComplete="organization"
            className="input"
            placeholder="Acme"
          />
        </Field>
        <Field label="Website (optional)">
          <input
            name="website"
            type="text"
            maxLength={MAX.website}
            autoComplete="url"
            className="input"
            placeholder="acme.com"
          />
        </Field>
      </div>

      <div className="mt-6">
        <Field label="What do you have in mind">
          <textarea
            name="message"
            required
            rows={6}
            maxLength={MAX.message}
            className="textarea"
            placeholder="What you're building, where names would fit, and roughly what scale you're thinking about."
          />
        </Field>
      </div>

      {error ? (
        // role=alert so the failure is announced, not just recoloured — the button
        // returning from "Sending…" is otherwise the only signal something changed.
        <p role="alert" className="bad mt-5 text-sm leading-relaxed">
          {error}
        </p>
      ) : null}

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <button
          type="submit"
          className="btn btn-ink btn-lg"
          disabled={sending || !ready}
        >
          {sending ? "Sending…" : "Send it"}
          {sending ? null : <ArrowNE />}
        </button>
        <p className="data max-w-[38ch] text-[11px] leading-[1.7] text-[var(--faint)]">
          Goes straight to a person. No list, no newsletter, no wallet needed.
        </p>
      </div>
    </form>
  );
}
