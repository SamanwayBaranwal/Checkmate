import type { Metadata } from 'next';
import { LegalPage, Section, Contact } from '@/components/legal/LegalPage';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'What data ELO collects, why, who can see it, and how to delete it.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={<>This policy explains what information ELO collects when you play, why we need it, and the choices you have. We don&apos;t sell your data and we don&apos;t show ads.</>}
    >
      <Section n={1} title="What we collect">
        <ul>
          <li><strong>Login.</strong> You sign in through Privy (email, Google or a crypto wallet). We receive a Privy account ID and a wallet address. Privy handles your email or Google login under its own privacy policy.</li>
          <li><strong>Profile.</strong> Your username, rating, game statistics, settings, friends, referral code and notifications.</li>
          <li><strong>Games.</strong> Every move, the time taken per move, whether the game tab was in the background during a move, results, credits staked and won, and game chat messages while the game is live.</li>
          <li><strong>Fair-play data.</strong> Automated analysis of your games (how closely your moves match a chess engine) and any reports made by or about you.</li>
          <li><strong>Device and network.</strong> Your IP address, a random device ID stored in your browser, and a browser fingerprint. We store these only as salted one-way hashes, used to spot duplicate accounts.</li>
          <li><strong>Credits history.</strong> A log of every credit added or deducted.</li>
        </ul>
      </Section>

      <Section n={2} title="Why we use it">
        <ul>
          <li>To run your account, match you with opponents, play games, keep ratings and show leaderboards.</li>
          <li>To keep games fair: detect engine use, collusion and multiple accounts, and protect other players.</li>
          <li>To keep ELO secure and working: rate limiting, abuse prevention, fixing bugs.</li>
        </ul>
      </Section>

      <Section n={3} title="What other players can see">
        <p>Your <strong>username, rating, game statistics, game results and replays</strong> are public and appear on profiles and leaderboards. Your opponent and spectators see game chat. Your login details, device data and fair-play analysis are never shown to other players.</p>
      </Section>

      <Section n={4} title="Who we share it with">
        <p>Only with services that help us run ELO, and only what they need:</p>
        <ul>
          <li><strong>Privy</strong> for login and wallets;</li>
          <li>our <strong>hosting and database providers</strong>, which store and process data on our behalf.</li>
        </ul>
        <p>We may disclose information if required by law or to protect players and the service. We do not sell personal data.</p>
      </Section>

      <Section n={5} title="Storage in your browser">
        <p>We keep your session token, device ID and preferences (board theme, sound and similar) in your browser&apos;s local storage. Privy may set its own cookies to keep you logged in. We don&apos;t use advertising or tracking cookies.</p>
      </Section>

      <Section n={6} title="How long we keep it">
        <p>We keep your data while your account is active. When you delete your account in Settings, we remove your username, login ID, wallet address, settings and credits. Game records stay (without your name) so your opponents&apos; histories and ratings stay correct. We keep the hashed device and network identifiers and fair-play records so banned players can&apos;t simply sign up again.</p>
      </Section>

      <Section n={7} title="Your choices and rights">
        <p>You can change your username and settings at any time and delete your account in Settings. You can also ask us for a copy of your data, or to correct or delete it; <Contact />. Depending on where you live, you may have further rights under local data protection law.</p>
      </Section>

      <Section n={8} title="Children">
        <p>ELO is not meant for children under 13. Players under 18 need permission from a parent or guardian. If you believe a child under 13 has an account, <Contact /> and we will delete it.</p>
      </Section>

      <Section n={9} title="Security">
        <p>Data is sent over encrypted connections, device and network identifiers are hashed, and access to admin tools is restricted. No system is perfectly secure, so please keep your login safe.</p>
      </Section>

      <Section n={10} title="Changes and contact">
        <p>We may update this policy and will note important changes in the app. Questions? <Contact />.</p>
      </Section>
    </LegalPage>
  );
}
