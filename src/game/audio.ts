/** Tiny WebAudio synth for game sounds — no assets, ~0 cost. */
let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function blip(freq: number, dur = 0.06, type: OscillatorType = 'square', vol = 0.05) {
  const a = ac();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(vol, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
  o.connect(g).connect(a.destination);
  o.start();
  o.stop(a.currentTime + dur);
}

export const sfx = {
  paddle: () => blip(220, 0.05, 'square', 0.04),
  wall: () => blip(180, 0.04, 'square', 0.03),
  brick: () => blip(440 + Math.random() * 120, 0.06, 'square', 0.05),
  brickHard: () => blip(300, 0.05, 'sawtooth', 0.04),
  powerup: () => {
    blip(520, 0.08, 'sine', 0.06);
    setTimeout(() => blip(780, 0.1, 'sine', 0.06), 70);
  },
  laser: () => blip(900, 0.05, 'sawtooth', 0.03),
  lose: () => {
    blip(300, 0.15, 'sine', 0.07);
    setTimeout(() => blip(200, 0.25, 'sine', 0.07), 140);
  },
  levelUp: () => {
    [440, 550, 660, 880].forEach((f, i) => setTimeout(() => blip(f, 0.1, 'sine', 0.06), i * 80));
  },
};
