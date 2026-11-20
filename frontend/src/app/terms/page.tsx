import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, Section, Contact } from '@/components/legal/LegalPage';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The rules for playing on ELO: accounts, free credits, fair play and conduct.',
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro={<>These terms are the rules for using ELO (the website, app and games). By creating an account or playing, you agree to them. If you don&apos;t agree, please don&apos;t use ELO.</>}
    >
      <Section n={1} title="Who can play">
        <p>You must be at least 13 years old. If you are under 18, you need permission from a parent or guardian, who also agrees to these terms for you.</p>
        <p>You may not use ELO where doing so is against the law that applies to you.</p>
      </Section>

      <Section n={2} title="Your account">
        <ul>
          <li><strong>One person, one account.</strong> Don&apos;t create or use more than one account, and don&apos;t share yours.</li>
          <li>You are responsible for what happens on your account and for keeping your login (email, Google or wallet) secure.</li>
          <li>To enforce one account per person, we check whether accounts share a device or network (see our <Link href="/privacy" className="text-ink underline underline-offset-2">Privacy Policy</Link>).</li>
          <li>Usernames must not impersonate others or be offensive. We may change or remove a username that breaks these rules.</li>
        </ul>
      </Section>

      <Section n={3} title="Credits">
        <p><strong>ELO is free to play.</strong> Credits are given to you for free (for example the starter credits and daily bonus). They:</p>
        <ul>
          <li>have <strong>no cash value</strong> and cannot be bought, sold, withdrawn or exchanged for money, crypto or anything else;</li>
          <li>are not your property: they are a feature of the game that we can change, limit, reset or remove;</li>
          <li>are staked in rated games: the winner receives both stakes minus a small platform fee, and drawn or cancelled games are refunded.</li>
        </ul>
        <p>Winnings may stay locked for a period while the game is checked for fair play.</p>
      </Section>

      <Section n={4} title="Fair play">
        <p>Play every game yourself. You may not:</p>
        <ul>
          <li>use a chess engine, bot, app, website, book or another person to help you during a game;</li>
          <li>arrange results, lose on purpose, or play against your own second account (collusion or multi-accounting);</li>
          <li>exploit bugs, interfere with the service, or automate play or requests.</li>
        </ul>
        <p>Games are checked by an automated analysis (including the Stockfish chess engine) and may be reviewed by a person. If we believe you broke these rules, we may lock or remove credits, reverse game results and return stakes to your opponents, reset your rating, and suspend or close your account. Our decision on fair play is final, but you can contact us if you think we made a mistake.</p>
      </Section>

      <Section n={5} title="How you behave">
        <p>Be respectful in chat, usernames and reports. No harassment, hate, threats, spam, scams or sharing other people&apos;s personal information. Use the report button for problems with an opponent; don&apos;t abuse it.</p>
      </Section>

      <Section n={6} title="The service">
        <p>We work hard to keep ELO running, but it is provided &quot;as is&quot;. Games can be affected by connection problems, outages or bugs. If a game fails because of a problem on our side, we may cancel it and refund the stakes. We may change, pause or stop any feature at any time.</p>
      </Section>

      <Section n={7} title="Liability">
        <p>To the extent the law allows, ELO is not liable for indirect or consequential losses, or for loss of credits, ratings or data. Nothing in these terms limits rights you have under consumer law that cannot be excluded.</p>
      </Section>

      <Section n={8} title="Ending your account">
        <p>You can delete your account at any time in Settings. Any remaining credits are forfeited. We may suspend or close accounts that break these terms.</p>
      </Section>

      <Section n={9} title="Changes">
        <p>We may update these terms. If the changes are important we will tell you in the app. Continuing to play after an update means you accept the new terms.</p>
      </Section>

      <Section n={10} title="Contact">
        <p>Questions about these terms? <Contact />.</p>
      </Section>
    </LegalPage>
  );
}
