import { Header } from "./Header";
import { Footer } from "./Footer";

export type LegalSection = {
  heading: string;
  paragraphs: React.ReactNode[];
};

/**
 * Shared shell for /terms, /privacy and /disclaimer — the same type roles as the rest
 * of the site, at the one measure long-form reading actually wants.
 */
export function LegalPage({
  eyebrow,
  title,
  updated,
  intro,
  sections,
}: {
  eyebrow: string;
  title: string;
  updated: string;
  intro: React.ReactNode;
  sections: LegalSection[];
}) {
  return (
    <>
      <Header />
      <main className="shell pb-24 pt-[clamp(40px,5vw,64px)]">
        <section className="max-w-[65ch] border-b border-[var(--line)] pb-10">
          <div className="eyebrow">{eyebrow}</div>
          <h1 className="h-page mt-[18px]">{title}</h1>
          <p className="data mt-5 text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">
            Last updated: {updated}
          </p>
          <p className="mt-6 text-[15px] leading-relaxed text-[var(--dim)]">{intro}</p>
        </section>
        {sections.map((s, i) => (
          <section key={s.heading} className="mt-12 max-w-[65ch]">
            <h2 className="h-sub flex gap-4">
              <span className="data shrink-0 pt-1 text-[11px] tracking-[0.16em] text-[var(--faint)]">
                {String(i + 1).padStart(2, "0")}
              </span>
              {s.heading}
            </h2>
            {s.paragraphs.map((p, j) => (
              <p key={j} className="mt-4 text-[15px] leading-relaxed text-[var(--dim)]">
                {p}
              </p>
            ))}
          </section>
        ))}
      </main>
      <Footer />
    </>
  );
}
