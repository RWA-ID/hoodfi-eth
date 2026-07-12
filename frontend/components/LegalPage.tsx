import { Header } from "./Header";
import { Footer } from "./Footer";

export type LegalSection = {
  heading: string;
  paragraphs: React.ReactNode[];
};

/**
 * Shared shell for /terms, /privacy and /disclaimer — same terminal-ledger
 * type roles as the rest of the site, tuned for long-form reading.
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
      <main className="mx-auto max-w-3xl px-4 sm:px-6">
        <section className="pt-16 sm:pt-20">
          <div className="eyebrow">{eyebrow}</div>
          <h1 className="display mt-4 text-3xl sm:text-5xl">{title}</h1>
          <p className="data mt-4 text-xs text-[var(--faint)]">
            Last updated: {updated}
          </p>
          <p className="mt-6 max-w-[65ch] text-sm leading-relaxed text-[var(--dim)]">
            {intro}
          </p>
        </section>
        {sections.map((s, i) => (
          <section key={s.heading} className="mt-10">
            <h2 className="display text-lg">
              <span className="data mr-3 text-xs text-[var(--faint)]">
                {String(i + 1).padStart(2, "0")}
              </span>
              {s.heading}
            </h2>
            {s.paragraphs.map((p, j) => (
              <p
                key={j}
                className="mt-3 max-w-[65ch] text-sm leading-relaxed text-[var(--dim)]"
              >
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
