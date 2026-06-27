import { base } from 'viem/chains';

export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID!;

export const privyConfig = {
  defaultChain: base,
  supportedChains: [base],
  appearance: {
    theme: 'dark' as const,
    accentColor: '#4caf50',
    logo: '/logo.png',
  },
  embeddedWallets: {
    createOnLogin: 'users-without-wallets' as const,
  },
};
