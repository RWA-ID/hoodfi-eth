/**
 * A margin note beside a form — an eyebrow, a short title, a sentence of plain English.
 *
 * Both columns of the manage page use these to fill the space next to something tall,
 * so they are one component: two sets drifting apart in size or weight would read as
 * two different kinds of thing when they are the same kind of thing.
 */
export function PrimerCard({
  eyebrow,
  title,
  className = "",
  children,
}: {
  eyebrow: string;
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`shadow-card flex flex-col gap-[9px] border border-[var(--line-card)] bg-[var(--paper-alt)] px-[17px] pb-5 pt-[18px] ${className}`}
    >
      <span className="data text-[10px] uppercase tracking-[0.18em] text-[rgba(11,14,8,0.55)]">
        {eyebrow}
      </span>
      <h4 className="text-[18px] font-bold leading-[1.12] tracking-[-0.025em]">{title}</h4>
      <p className="text-[12.5px] leading-[1.55] text-pretty text-[var(--dim)]">
        {children}
      </p>
    </div>
  );
}
