import Link from 'next/link';

export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || '';
export const LAST_UPDATED = '19 November 2026';

/** Shared shell for Terms and Privacy: readable column, numbered sections, contact footer. */
export function LegalPage({ title, intro, children }: { title: string; intro: React.ReactNode; children: React.ReactNode }) {
  return (
    <article className="max-w-2xl mx-auto px-4 md:px-8 pt-6 md:pt-12 pb-16">
      <p className="eyebrow mb-2">Last updated {LAST_UPDATED}</p>
      <h1 className="text-3xl md:text-4xl font-black tracking-tight">{title}</h1>
      <div className="text-muted font-medium mt-4 leading-relaxed">{intro}</div>
      <div className="mt-8 space-y-8">{children}</div>
      <div className="mt-12 pt-6 border-t border-line/[0.07] text-sm text-faint font-medium flex flex-wrap gap-x-5 gap-y-2">
        <Link href="/terms" className="hover:text-ink">Terms</Link>
        <Link href="/privacy" className="hover:text-ink">Privacy</Link>
        <Link href="/" className="hover:text-ink">Home</Link>
      </div>
    </article>
  );
}

export function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-extrabold"><span className="text-faint num mr-2">{n}.</span>{title}</h2>
      <div className="mt-2 space-y-3 text-[15px] text-muted leading-relaxed [&_strong]:text-ink [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5">
        {children}
      </div>
    </section>
  );
}

export function Contact() {
  return CONTACT_EMAIL
    ? <>email us at <a href={`mailto:${CONTACT_EMAIL}`} className="text-ink underline underline-offset-2">{CONTACT_EMAIL}</a></>
    : <>contact us through the email address listed on our website</>;
}
