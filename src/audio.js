// audio: WebAudio synthesis only, no files. Starts on the first key or click (browser rule).
import { events } from './core.js';
let ac = null, master = null, noise = null; const loops = {};
function boot() {
  if (ac) return; const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ac = new AC(); master = ac.createGain(); master.gain.value = 0.5; master.connect(ac.destination);
  noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate); const d = noise.getChannelData(0); let b = 0;
  for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b = (b + 0.02 * w) / 1.02; d[i] = i % 2 ? w * 0.6 : b * 3.2; }
  for (const [n, f, q] of [['wind', 320, 0.6], ['engine', 70, 0.8], ['drill', 900, 3], ['rcs', 2400, 0.7]]) {
    const s = ac.createBufferSource(); s.buffer = noise; s.loop = true; const fl = ac.createBiquadFilter(); fl.type = n === 'drill' ? 'bandpass' : 'lowpass'; fl.frequency.value = f; fl.Q.value = q;
    const g = ac.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(master); s.start(); loops[n] = { g, fl };
  }
}
events.on('gesture', boot);
function burst(dur, freq, q, vol, type = 'bandpass') {
  const s = ac.createBufferSource(); s.buffer = noise; const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ac.createGain(); g.gain.setValueAtTime(vol, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(ac.currentTime, Math.random()); s.stop(ac.currentTime + dur);
}
function tone(dur, f0, f1, vol, type = 'sine') {
  const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, ac.currentTime); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), ac.currentTime + dur);
  const g = ac.createGain(); g.gain.setValueAtTime(vol, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
  o.connect(g); g.connect(master); o.start(); o.stop(ac.currentTime + dur);
}
const S = {
  shot() { burst(0.16, 1800, 0.4, 0.9); tone(0.14, 130, 45, 0.9); tone(0.5, 2600, 2300, 0.03); },
  shotgun() { burst(0.3, 900, 0.3, 1.0); tone(0.25, 90, 35, 1.0); },
  tink() { tone(0.09, 3800 + Math.random() * 1800, 3200, 0.05, 'triangle'); },
  step() { burst(0.05, 260 + Math.random() * 120, 1, 0.12, 'lowpass'); },
  hit() { burst(0.08, 700, 1, 0.3); },
  bite() { tone(0.25, 240, 60, 0.4, 'sawtooth'); burst(0.2, 500, 2, 0.3); },
  call() { tone(0.7, 520 + Math.random() * 200, 140, 0.07, 'sawtooth'); tone(0.5, 1260, 380, 0.03, 'square'); },
  thud() { tone(0.2, 80, 30, 0.6); },
  cannon() { tone(0.18, 70, 28, 0.8); burst(0.1, 200, 0.7, 0.3, 'lowpass'); },
  groan() { tone(0.6, 60 + Math.random() * 30, 34, 0.5, 'sawtooth'); burst(0.3, 150, 1, 0.4, 'lowpass'); },
  click() { tone(0.03, 1400, 1100, 0.05, 'square'); },
  place() { burst(0.07, 400, 1, 0.3, 'lowpass'); tone(0.06, 180, 90, 0.2); },
};
export const audio = {
  play(n) { if (ac && ac.state === 'running' && S[n]) S[n](); },
  loop(n, v, f) { const l = loops[n]; if (!l) return; l.g.gain.setTargetAtTime(v, ac.currentTime, 0.08); if (f) l.fl.frequency.setTargetAtTime(f, ac.currentTime, 0.1); },
};
