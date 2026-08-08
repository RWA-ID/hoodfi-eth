"use client";

import { useState } from "react";
import { avatarToUrl } from "@/lib/ens";

/** The house mark, used when a name has no avatar of its own. */
const FALLBACK_SRC = "/hoodfi-h.png";

/**
 * A name's avatar, with a three-step fallback: the owner's `avatar` record, then the
 * HoodFi H, then the name's own initials.
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
  const src = avatarToUrl(avatar);
  const [ownerFailed, setOwnerFailed] = useState(false);
  const [markFailed, setMarkFailed] = useState(false);

  const showOwner = Boolean(src) && !ownerFailed;
  const showMark = !showOwner && !markFailed;

  const shell = `shrink-0 rounded-full border border-[var(--line)] ${className}`;

  if (showOwner) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- static export, no optimizer
      <img
        src={src}
        alt=""
        className={`${shell} object-cover`}
        onError={() => setOwnerFailed(true)}
      />
    );
  }

  if (showMark) {
    return (
      <div className={`${shell} grid place-items-center bg-[var(--panel-2)]`}>
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
