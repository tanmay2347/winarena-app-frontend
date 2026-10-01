/* Tiny WebAudio synth — no asset files, everything is generated. */
let ctx = null;
let enabled = true;

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function setSound(on) { enabled = on; }
export function soundOn() { return enabled; }

function tone({ freq = 440, dur = 0.12, type = 'sine', gain = 0.2, sweep = 0, delay = 0 }) {
  if (!enabled) return;
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (sweep) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + sweep), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise({ dur = 0.12, gain = 0.2, freq = 1200, delay = 0 }) {
  if (!enabled) return;
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = 1.2;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(c.destination);
  src.start(t0);
}

export const sfx = {
  strike(power = 0.5) {
    noise({ dur: 0.09, gain: 0.08 + power * 0.18, freq: 900 + power * 900 });
    tone({ freq: 180 - power * 40, dur: 0.09, type: 'triangle', gain: 0.1 + power * 0.12, sweep: -80 });
  },
  pocket() {
    noise({ dur: 0.22, gain: 0.16, freq: 520 });
    tone({ freq: 520, dur: 0.16, type: 'sine', gain: 0.12, sweep: -220, delay: 0.02 });
  },
  foul() {
    tone({ freq: 220, dur: 0.28, type: 'sawtooth', gain: 0.1, sweep: -110 });
    tone({ freq: 165, dur: 0.32, type: 'square', gain: 0.05, delay: 0.06 });
  },
  win() {
    [523, 659, 784, 1047].forEach((f, i) =>
      tone({ freq: f, dur: 0.3, type: 'triangle', gain: 0.14, delay: i * 0.11 }));
  },
  lose() {
    [392, 330, 262].forEach((f, i) =>
      tone({ freq: f, dur: 0.34, type: 'sine', gain: 0.12, delay: i * 0.14 }));
  },
  click() { tone({ freq: 660, dur: 0.05, type: 'square', gain: 0.05 }); },
  match() {
    [440, 554, 659].forEach((f, i) => tone({ freq: f, dur: 0.22, type: 'sine', gain: 0.12, delay: i * 0.09 }));
  }
};
