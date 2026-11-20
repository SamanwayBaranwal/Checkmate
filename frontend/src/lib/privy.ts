import { base } from 'viem/chains';

export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID!;

export const privyConfig = {
  defaultChain: base,
  supportedChains: [base],
  appearance: {
    theme: 'dark' as const,
    accentColor: '#F6F6F7' as `#${string}`,
    logo: '/brand/elo-logo.png',
  },
  // Links shown in the login modal footer
  legal: { termsAndConditionsUrl: '/terms', privacyPolicyUrl: '/privacy' },
  embeddedWallets: {
    createOnLogin: 'users-without-wallets' as const,
  },
};
