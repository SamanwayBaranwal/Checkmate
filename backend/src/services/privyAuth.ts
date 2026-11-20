import { createRemoteJWKSet, jwtVerify } from 'jose';

/**
 * Verifies a Privy access token (ES256 JWT) against Privy's public keys for our app.
 * Returns the Privy user id (the token's `sub`, e.g. "did:privy:...").
 *
 * Why: /api/auth/verify used to trust any `privyUserId` sent in the request body,
 * so anyone could log in as any user. The user id now comes ONLY from a token that
 * Privy signed.
 *
 * Local testing without Privy: set AUTH_DEV_BYPASS=true (refused when NODE_ENV=production).
 */
const APP_ID = process.env.PRIVY_APP_ID || '';
const jwks = APP_ID
  ? createRemoteJWKSet(new URL(`https://auth.privy.io/api/v1/apps/${APP_ID}/jwks.json`))
  : null;

// Also never on Railway, even if NODE_ENV was forgotten there (bypass = anyone can log in as anyone)
export const devBypassEnabled =
  process.env.AUTH_DEV_BYPASS === 'true' && process.env.NODE_ENV !== 'production' &&
  !process.env.RAILWAY_ENVIRONMENT_NAME && !process.env.RAILWAY_PROJECT_ID;

export async function verifyPrivyAccessToken(token: string | undefined): Promise<string> {
  if (!token) throw new Error('Missing Privy access token');
  if (!jwks) throw new Error('PRIVY_APP_ID is not configured on the server');
  const { payload } = await jwtVerify(token, jwks, { issuer: 'privy.io', audience: APP_ID });
  if (!payload.sub) throw new Error('Token has no subject');
  return payload.sub;
}

if (!APP_ID && !devBypassEnabled) {
  console.warn('PRIVY_APP_ID not set: all logins will be rejected');
}
if (devBypassEnabled) {
  console.warn('AUTH_DEV_BYPASS is ON: logins are NOT verified (local development only)');
}
