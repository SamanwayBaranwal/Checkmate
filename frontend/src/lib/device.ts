// One person, one account (no KYC): a random device id kept in this browser plus a coarse fingerprint.
// The server only stores salted hashes of these. They are used to stop self-play / bonus farming and
// to keep banned players from coming back with a new account.

export function getDeviceId(): string {
  if (typeof window === 'undefined') return '';
  try {
    let id = localStorage.getItem('checkmate_device');
    if (!id) {
      id = (crypto as any).randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem('checkmate_device', id);
    }
    return id;
  } catch {
    return '';
  }
}

export function getFingerprint(): string {
  if (typeof window === 'undefined') return '';
  const n = navigator as any;
  return [
    n.userAgent, n.language, n.platform, n.hardwareConcurrency, n.deviceMemory,
    screen.width, screen.height, screen.colorDepth, window.devicePixelRatio,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ].join('|');
}
