/**
 * The north-east arrow, drawn rather than typed.
 *
 * `↗` U+2197 carries Emoji=Yes, and neither Archivo nor the mono ships the glyph — so
 * iOS falls through the font stack to Apple Color Emoji and the arrow lands as a blue
 * emoji in the middle of a lime button. Drawing it keeps it monochrome, on
 * currentColor, at the weight of the type beside it, and identical on every platform.
 *
 * Square caps, no rounding: the same corner treatment as every border in the design.
 */
export function ArrowNE({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 12 12"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="square"
      className={`inline-block shrink-0 ${className}`}
    >
      <path d="M3.1 8.9 8.7 3.3" />
      <path d="M4.4 3.3h4.4v4.4" />
    </svg>
  );
}

/**
 * A left/right chevron for the sliding name rows, drawn for the same reason as the arrow
 * above and mitred the same way.
 */
export function Chevron({
  dir,
  className = "",
}: {
  dir: "left" | "right";
  className?: string;
}) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 12 12"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="square"
      className={`inline-block shrink-0 ${className}`}
    >
      <path d={dir === "left" ? "M7.6 2.4 4 6l3.6 3.6" : "M4.4 2.4 8 6l-3.6 3.6"} />
    </svg>
  );
}
