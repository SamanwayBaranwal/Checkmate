// Real recorded wooden piece sounds (Kenney "Impact Sounds", CC0: public/sounds/LICENSE-kenney-impact-sounds.txt).
// Decoded once into Web Audio buffers so they play instantly with no lag, even on low-end phones.

const FILES = {
  move: ['/sounds/move0.mp3', '/sounds/move1.mp3', '/sounds/move2.mp3', '/sounds/move3.mp3', '/sounds/move4.mp3'],
  capture: ['/sounds/capture.mp3'],
  check: ['/sounds/check.mp3'],
  end: ['/sounds/end.mp3'],
  tick: ['/sounds/tick.mp3'],
};
type Kind = keyof typeof FILES;

let ctx: AudioContext | null = null;
const buffers: Partial<Record<Kind, AudioBuffer[]>> = {};
let loading: Promise<void> | null = null;

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const C = window.AudioContext || (window as any).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  return ctx;
}

function load(): Promise<void> {
  if (loading) return loading;
  const c = ac();
  if (!c) return Promise.resolve();
  loading = Promise.all(
    (Object.keys(FILES) as Kind[]).map(async (k) => {
      buffers[k] = await Promise.all(FILES[k].map(async (url) => {
        const res = await fetch(url);
        return c.decodeAudioData(await res.arrayBuffer());
      }));
    }),
  ).then(() => undefined).catch(() => { loading = null; });
  return loading;
}

// Start decoding early (first user gesture unlocks audio on iOS)
if (typeof window !== 'undefined') {
  const unlock = () => { ac()?.resume(); load(); window.removeEventListener('pointerdown', unlock); };
  window.addEventListener('pointerdown', unlock, { passive: true });
  setTimeout(load, 1500);
}

function play(kind: Kind, volume = 0.8, rate = 1) {
  const c = ac();
  if (!c) return;
  if (c.state === 'suspended') c.resume();
  const list = buffers[kind];
  if (!list || !list.length) { load(); return; }
  const src = c.createBufferSource();
  src.buffer = list[Math.floor(Math.random() * list.length)];
  src.playbackRate.value = rate;
  const g = c.createGain();
  g.gain.value = volume;
  src.connect(g).connect(c.destination);
  src.start();
}

function haptic(ms: number | number[]) {
  try { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(ms); } catch {}
}

export const sounds = {
  move: () => play('move', 0.75),
  capture: () => { play('capture', 0.9); haptic(15); },
  check: () => { play('check', 0.85); haptic(25); },
  win: () => { play('end', 0.7); haptic([30, 40, 30]); },
  lose: () => { play('end', 0.55, 0.85); haptic(40); },
  draw: () => { play('end', 0.55, 0.92); },
  clockLow: () => play('tick', 0.5),
};
