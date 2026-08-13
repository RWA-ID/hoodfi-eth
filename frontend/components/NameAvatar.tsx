"use client";

import { useState } from "react";
import { avatarUrls } from "@/lib/ens";

/** The house mark, used when a name has no avatar of its own. */
const FALLBACK_SRC = "/hoodfi-h.png";

/**
 * A name's avatar, with a three-step fallback: the owner's `avatar` record, then the
 * HoodFi H, then the name's own initials.
 *
 * The first step has steps of its own: an `ipfs://` record is tried against our own
 * gateway before a public one, so the common case — an avatar uploaded here minutes
 * ago — is served by the account that pinned it instead of waiting on the network.
 *
 * The H is dimmed and desaturated so it reads as "no avatar set" rather than as a
 * name whose avatar happens to be our logo — a real distinction here, since some
 * names genuinely use it. The final initials step means a missing asset degrades
 * instead of leaving an empty circle.
 */
export function NameAvatar({
  label,
  avatar,
  className = "h-20 w-20 sm:h-24 sm:w-24",
  textClassName = "text-xl",
}: {
  label: string;
  avatar: string;
  className?: string;
  textClassName?: string;
}) {
  const sources = avatarUrls(avatar);
  const [attempt, setAttempt] = useState(0);
  const [markFailed, setMarkFailed] = useState(false);

  // A new record starts the gateway list over — without this, a name whose old avatar
  // exhausted every candidate would never try the new one. Adjusted during render
  // rather than in an effect: an effect runs after the paint, so the first frame of a
  // just-uploaded avatar would show the house mark before correcting itself.
  const [shown, setShown] = useState(avatar);
  if (shown !== avatar) {
    setShown(avatar);
    setAttempt(0);
  }

  const src = sources[attempt] ?? "";
  const showOwner = Boolean(src);
  const showMark = !showOwner && !markFailed;

  // Square, like everything else here — the only circle in this design is the tier
  // radio on the homepage.
  const shell = `shrink-0 border border-[var(--line-card)] ${className}`;

  if (showOwner) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- static export, no optimizer
      <img
        src={src}
        alt=""
        className={`${shell} object-cover`}
        onError={() => setAttempt((i) => i + 1)}
      />
    );
  }

  if (showMark) {
    return (
      <div className={`${shell} grid place-items-center bg-[var(--paper-alt)]`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- static export, no optimizer */}
        <img
          src={FALLBACK_SRC}
          alt=""
          className="h-1/2 w-1/2 object-contain opacity-40"
          onError={() => setMarkFailed(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={`${shell} grid place-items-center text-[var(--faint)] ${textClassName}`}
    >
      {label.slice(0, 2)}
    </div>
  );
}
