"use client";

import { SITE } from "@/lib/site";
import { track } from "@/lib/analytics";

export function XLogo({ size = 13 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644Z" />
    </svg>
  );
}

/**
 * Share button. The URL is appended here rather than baked into each caller's text,
 * so every share links somewhere consistent and trackable.
 */
export function ShareOnX({
  text,
  url = SITE.url,
  className = "btn btn-ghost",
  eventLabel,
  children = "Share on X",
}: {
  text: string;
  url?: string;
  className?: string;
  eventLabel?: string;
  children?: React.ReactNode;
}) {
  const href = `https://x.com/intent/post?text=${encodeURIComponent(`${text}\n${url}`)}`;
  return (
    <a
      className={className}
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={() => track("share_clicked", { method: eventLabel })}
    >
      <XLogo /> {children}
    </a>
  );
}
