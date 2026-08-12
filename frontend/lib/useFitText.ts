"use client";

import { useLayoutEffect, useRef, useState } from "react";

/** Large enough that rounding in the ratio is irrelevant. */
export const PROBE_SIZE = 100;

/**
 * Size text to the width it has, by measuring it.
 *
 * Estimating from a character count does not work here. Calibrated on "a" every case
 * fits; the same 32 characters as "m" overflow by half again, because Archivo's widest
 * lowercase is far wider than its narrowest. Only the glyphs actually typed know how
 * wide they are, so the caller renders an off-screen twin at PROBE_SIZE — same family,
 * weight and tracking — and the ratio between that and the available width is exact.
 *
 * `getMaxSize` is read at fit time rather than captured, so a responsive ceiling
 * (`clamp(...)` expressed in JS) stays correct across a resize.
 */
export function useFitText<C extends HTMLElement = HTMLDivElement>(
  text: string,
  getMaxSize: () => number,
  minSize: number,
  fallbackSize: number
) {
  const columnRef = useRef<C | null>(null);
  const probeRef = useRef<HTMLSpanElement | null>(null);

  const maxRef = useRef(getMaxSize);
  maxRef.current = getMaxSize;

  const [fontSize, setFontSize] = useState(fallbackSize);

  useLayoutEffect(() => {
    const column = columnRef.current;
    const probe = probeRef.current;
    if (!column || !probe) return;

    const fit = () => {
      const available = column.clientWidth;
      const atProbeSize = probe.getBoundingClientRect().width;
      if (!available || !atProbeSize) return;
      const fitted = (available / atProbeSize) * PROBE_SIZE;
      setFontSize(Math.max(minSize, Math.min(maxRef.current(), fitted)));
    };

    // Before paint, so the corrected size is the first thing drawn.
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(column);
    // Measuring before Archivo lands sizes the text to the fallback's metrics.
    document.fonts?.ready.then(fit).catch(() => {});
    return () => observer.disconnect();
  }, [text, minSize]);

  return { columnRef, probeRef, fontSize };
}
