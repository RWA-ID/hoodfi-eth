"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { PAYBOX_APPS, type PayboxApp } from "@/lib/paybox";

/**
 * The three connector recordings on `/mcp`, as cards that play in place and can be
 * opened larger without leaving the section.
 *
 * ## Why this is a client component and `PayboxSection` is not
 *
 * The section around it is static, and should stay that way — it is the page's copy.
 * Only this grid needs state, so only this grid crosses into the client. Do not lift
 * `"use client"` up into `PayboxSection` or the page: every route on this site is a
 * static export, and a client boundary that high has already cost us per-page OG
 * cards once.
 *
 * ## Why the cards kick their own playback
 *
 * The markup was right all along — `autoplay muted playsinline` renders correctly
 * into the export, the clips are faststart H.264 with no audio track, and the host
 * serves them as `video/mp4` with range support. They still sat dead on the live
 * page: `readyState 0`, `networkState 1` (IDLE), `duration NaN`. Nothing had been
 * *fetched*. Chrome defers loading media that is far below the fold under
 * `preload="metadata"`, and once that deferral has gone idle, scrolling the element
 * into view does not wake it — the load never starts, so there is nothing for
 * autoplay to start playing. An explicit `load()` from an IntersectionObserver is
 * what actually begins the fetch.
 *
 * `preload="metadata"` stays: it is what keeps three simultaneous loops off the
 * critical path, and the whole point is that nothing loads until the card is nearly
 * on screen. The observer only decides *when*.
 *
 * `play()` is called too, and its rejection is swallowed on purpose. A muted inline
 * video is allowed to autoplay everywhere we support, but iOS Low Power Mode refuses
 * it outright — and that is exactly the case the View button below covers, since a
 * tap is a user gesture and no policy can refuse it. A rejected promise there is a
 * normal outcome, not an error worth logging.
 */

/** Starts at 0.2 rather than 0 so a card that is only just clipping the fold does
 *  not begin fetching; `rootMargin` gives the fetch a head start before it lands. */
const VISIBLE: IntersectionObserverInit = {
  rootMargin: "200px 0px",
  threshold: 0.2,
};

function DemoCard({
  app,
  index,
  onOpen,
}: {
  app: PayboxApp;
  index: number;
  onOpen: (app: PayboxApp) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Someone who has asked for less motion gets the poster and the View button.
    // Honoured as a one-shot read: a mid-visit change to the OS setting is not
    // worth a listener that would have to re-run the whole observer dance.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      video.autoplay = false;
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        // HAVE_NOTHING means the deferred load never started. Everything past
        // that point is already buffering, and calling load() again would throw
        // the buffer away and restart the clip.
        if (video.readyState === 0) video.load();
        void video.play().catch(() => {});
      }
    }, VISIBLE);

    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="shadow-lime flex min-w-0 flex-col border border-[var(--line-card)] bg-[var(--paper-alt)]">
      <div className="flex items-center gap-3.5 border-b border-[var(--line-soft)] px-5 py-4">
        <span className="data text-[10.5px] tracking-[0.18em] text-[var(--faint)]">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="flex h-6 w-[140px] flex-none items-center">
          <Image
            src={app.lockup.src}
            alt={app.label}
            width={app.lockup.width}
            height={app.lockup.height}
            className="block h-auto max-h-full w-auto max-w-full"
          />
        </span>
      </div>

      {/* The button sits over the video rather than under it: at this card width the
          clip is a ~220px-tall thumbnail of somebody's settings screen, so the thing
          that makes it legible belongs on top of it, not in the copy below. */}
      <div className="group relative">
        <video
          ref={videoRef}
          src={app.video}
          poster={app.poster}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-label={`Adding the PayBox connector in ${app.label}`}
          className="block h-auto w-full bg-[var(--ink)]"
        />
        <button
          type="button"
          onClick={() => onOpen(app)}
          /* Always legible, not hover-only: the same button is the fallback when
             autoplay is refused (iOS Low Power Mode), and on a touch screen there
             is no hover to reveal it with. Hover only firms it up. */
          className="btn btn-sm btn-lime absolute bottom-3 right-3 opacity-90 shadow-[0_2px_10px_rgba(11,14,8,0.35)] transition group-hover:opacity-100"
        >
          View
          <span className="sr-only"> the {app.label} connector walkthrough</span>
        </button>
      </div>

      <p className="px-5 pb-5 pt-4 text-sm leading-[1.55] text-[var(--dim)]">
        {app.step}
      </p>
    </div>
  );
}

/**
 * The centred player. A real `<dialog>` rather than a hand-rolled overlay, so the
 * top layer, the backdrop, Escape-to-close and focus containment are the browser's
 * job and not ours — it also means nothing on the page can clip or z-index over it,
 * which a fixed overlay inside a bordered section is always one stacking context
 * away from.
 */
function PlayerDialog({
  app,
  onClose,
}: {
  app: PayboxApp | null;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (app) {
      if (!dialog.open) dialog.showModal();
      const video = videoRef.current;
      if (video) {
        // Opened by a click, so this is a user gesture and sound is allowed. The
        // clips carry no audio track at all today, but muting a player someone
        // deliberately opened would be the wrong default the day one does.
        video.currentTime = 0;
        void video.play().catch(() => {});
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [app]);

  // Escape and the backdrop both route through `onClose` so the parent's state is
  // the single source of truth — a dialog closed behind React's back would leave
  // `app` set and refuse to reopen on the next click.
  return (
    <dialog
      ref={dialogRef}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
      /* Clicks land on the dialog itself only when they miss the panel inside it,
         which is what "clicked the backdrop" means for a centred box. */
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
      aria-label={app ? `${app.label}: adding the PayBox connector` : undefined}
      className="player-dialog"
    >
      {app && (
        <div className="flex w-full flex-col border border-[var(--ink)] bg-[var(--paper-alt)]">
          {/* Paper header, ink video well — deliberately not an all-ink panel. The
              lockups are each vendor's own art (the Claude mark is its orange,
              ChatGPT and Grok are black) and `lib/paybox.ts` forbids recolouring
              one, so the header has to be a ground they were drawn for. Inverting
              them to sit on ink would turn that orange blue. */}
          <div className="flex items-center gap-3.5 border-b border-[var(--line-card)] px-4 py-3">
            <span className="flex h-5 w-[120px] flex-none items-center">
              <Image
                src={app.lockup.src}
                alt={app.label}
                width={app.lockup.width}
                height={app.lockup.height}
                className="block h-auto max-h-full w-auto max-w-full"
              />
            </span>
            <span className="data ml-auto hidden text-[10.5px] uppercase tracking-[0.16em] text-[var(--faint)] sm:block">
              paybox connector
            </span>
            <button
              type="button"
              onClick={onClose}
              /* `ml-auto` as a fallback for when the label above is hidden on
                 narrow screens — otherwise Close slides left against the lockup. */
              className="btn btn-sm btn-ghost ml-auto sm:ml-0"
              /* autoFocus so Escape and Tab both have somewhere sensible to
                 start; without it the dialog focuses the <video>, whose own
                 controls swallow the arrow keys. */
              autoFocus
            >
              Close
            </button>
          </div>

          <video
            ref={videoRef}
            src={app.video}
            poster={app.poster}
            controls
            autoPlay
            loop
            playsInline
            preload="auto"
            className="block max-h-[70vh] w-full bg-[var(--ink)] object-contain"
          />

          <p className="border-t border-[var(--line-card)] px-4 pb-4 pt-3 text-[13.5px] leading-[1.55] text-[var(--dim)]">
            {app.step}
          </p>
        </div>
      )}
    </dialog>
  );
}

export function ConnectorDemos() {
  const [open, setOpen] = useState<PayboxApp | null>(null);
  const close = useCallback(() => setOpen(null), []);

  return (
    <>
      {/*
       * Grid, not `.cells`. With flex-wrap a lone third card grows to the full row
       * and renders its video 1.6× taller than the two above it; `auto-fit` +
       * `minmax` keeps every column the same width at every breakpoint. Do not
       * swap this for flex-wrap without capping the basis.
       *
       * `gap-5` is 20px against a 14px offset shadow, so each card's lime clears
       * the next card rather than painting across it. Never take this below 14px.
       */}
      <div className="mt-9 grid items-start gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))]">
        {PAYBOX_APPS.map((app, index) => (
          <DemoCard key={app.id} app={app} index={index} onOpen={setOpen} />
        ))}
      </div>

      <PlayerDialog app={open} onClose={close} />
    </>
  );
}
