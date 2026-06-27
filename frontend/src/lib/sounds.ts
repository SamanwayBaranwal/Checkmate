// Generates chess sounds using Web Audio API — no external files needed

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume = 0.15,
  decay = 0.8
) {
  if (typeof window === 'undefined') return;
  try {
    const ac = getCtx();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ac.currentTime);
    gain.gain.setValueAtTime(volume, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + duration);
  } catch {}
}

export const sounds = {
  move() {
    playTone(440, 0.08, 'square', 0.08);
  },
  capture() {
    playTone(280, 0.15, 'sawtooth', 0.12);
    setTimeout(() => playTone(220, 0.1, 'sawtooth', 0.08), 60);
  },
  check() {
    playTone(660, 0.1, 'sine', 0.15);
    setTimeout(() => playTone(880, 0.15, 'sine', 0.12), 80);
  },
  win() {
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => playTone(f, 0.3, 'sine', 0.15), i * 120);
    });
  },
  lose() {
    [523, 440, 349, 262].forEach((f, i) => {
      setTimeout(() => playTone(f, 0.3, 'sine', 0.12), i * 120);
    });
  },
  draw() {
    [440, 440].forEach((f, i) => {
      setTimeout(() => playTone(f, 0.2, 'sine', 0.1), i * 200);
    });
  },
  clockLow() {
    playTone(330, 0.05, 'square', 0.06);
  },
};
