// Procedural audio: generative background music, device sound effects, siren and voice prompts.
import { home } from './state.js';

let ctx = null, master, musicGain, musicLP, sirenGain, noiseBuf;
let nextStep = 0, step = 0, timer = null;
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

export const TRACKS = [
  { name: 'Sunset Lounge', artist: 'Digital Home Sessions', bpm: 92, style: 'lounge', chords: [[57, 60, 64, 67], [53, 57, 60, 64], [50, 53, 57, 60], [55, 59, 62, 65]] },
  { name: 'Midnight Drive', artist: 'Deep House Mix', bpm: 120, style: 'house', chords: [[57, 60, 64, 69], [53, 57, 60, 65], [48, 55, 60, 64], [55, 59, 62, 67]] },
  { name: 'Morning Light', artist: 'Piano Moods', bpm: 74, style: 'piano', chords: [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 67]] },
  { name: 'Golden Hour', artist: 'Chill Collection', bpm: 100, style: 'chill', chords: [[62, 65, 69, 72], [58, 62, 65, 69], [53, 57, 60, 65], [60, 64, 67, 70]] },
];

function env(node, t, a, d, peak) {
  node.gain.setValueAtTime(0.0001, t);
  node.gain.exponentialRampToValueAtTime(peak, t + a);
  node.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}
function tone(type, freq, t, a, d, peak, dest, lp) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  env(g, t, a, d, peak);
  if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; o.connect(f); f.connect(g); } else o.connect(g);
  g.connect(dest); o.start(t); o.stop(t + a + d + 0.05);
  return o;
}
function noise(t, d, peak, dest, type = 'highpass', freq = 6000) {
  const s = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
  s.buffer = noiseBuf; s.loop = true; f.type = type; f.frequency.value = freq;
  env(g, t, 0.004, d, peak);
  s.connect(f); f.connect(g); g.connect(dest); s.start(t, Math.random()); s.stop(t + d + 0.1);
}
function kick(t, peak = 0.5) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
  env(g, t, 0.003, 0.22, peak); o.connect(g); g.connect(musicGain); o.start(t); o.stop(t + 0.3);
}

function schedule() {
  if (!ctx) return;
  const tr = TRACKS[home.music.track], spb = 60 / tr.bpm / 4;
  if (nextStep < ctx.currentTime) nextStep = ctx.currentTime + 0.05;
  while (nextStep < ctx.currentTime + 0.25) {
    const t = nextStep, s = step % 16, bar = Math.floor(step / 16) % 4, ch = tr.chords[bar];
    const st = tr.style;
    if (s === 0) for (const n of ch) { tone('sawtooth', mtof(n), t, 0.4, spb * 16, 0.035, musicGain, 900); tone('sawtooth', mtof(n) * 1.006, t, 0.4, spb * 16, 0.025, musicGain, 700); }
    const bassSteps = { lounge: [0, 6, 8, 14], house: [2, 6, 10, 14], piano: [0, 8], chill: [0, 3, 8, 11] }[st];
    if (bassSteps.includes(s)) tone('triangle', mtof(ch[0] - 24), t, 0.01, spb * 3, 0.22, musicGain, 500);
    if (st === 'lounge' && s % 2 === 0) tone('triangle', mtof(ch[(s / 2) % 4] + 12), t, 0.005, 0.35, 0.07, musicGain);
    if (st === 'piano' && s % 2 === 0) { const seq = [0, 1, 2, 3, 2, 1, 2, 3]; tone('triangle', mtof(ch[seq[s / 2]] + 12), t, 0.005, 0.9, 0.1, musicGain); tone('sine', mtof(ch[seq[s / 2]] + 24), t, 0.005, 0.5, 0.03, musicGain); }
    if (st === 'house' && [0, 3, 6, 8, 11, 14].includes(s)) tone('square', mtof(ch[(s * 3) % 4] + 12), t, 0.005, 0.18, 0.04, musicGain, 1800);
    if (st === 'chill' && [0, 4, 7, 10, 12].includes(s)) tone('sine', mtof(ch[(s * 5) % 4] + 12), t, 0.01, 0.6, 0.09, musicGain);
    if (st === 'house') { if (s % 4 === 0) kick(t, 0.55); if (s % 4 === 2) noise(t, 0.05, 0.08, musicGain); if (s === 4 || s === 12) noise(t, 0.12, 0.1, musicGain, 'bandpass', 1800); }
    if (st === 'lounge' || st === 'chill') { if (s === 0 || s === 10) kick(t, 0.3); if (s % 4 === 2) noise(t, 0.04, 0.04, musicGain); if (s === 4 || s === 12) noise(t, 0.1, 0.05, musicGain, 'bandpass', 2200); }
    nextStep += spb; step++;
  }
}

export const audio = {
  ready: false, voice: true,
  init() {
    if (ctx) { ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
    musicLP = ctx.createBiquadFilter(); musicLP.type = 'lowpass'; musicLP.frequency.value = 16000; musicLP.connect(master);
    musicGain = ctx.createGain(); musicGain.gain.value = 0; musicGain.connect(musicLP);
    sirenGain = ctx.createGain(); sirenGain.gain.value = 0; sirenGain.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // Siren: two oscillators swept by an LFO, gated by sirenGain.
    const o = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = 900; lfo.frequency.value = 2.2; lg.gain.value = 320;
    lfo.connect(lg); lg.connect(o.frequency);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 0.8;
    o.connect(f); f.connect(sirenGain); o.start(); lfo.start();
    timer = setInterval(() => { if (home.music.playing) schedule(); }, 80);
    this.ready = true;
  },
  // 0..1 pulse in time with the music's quarter notes (drives Party-mode lighting).
  beat() {
    if (!ctx || !home.music.playing) return 0;
    const q = 60 / TRACKS[home.music.track].bpm;
    return Math.pow(1 - ((ctx.currentTime % q) / q), 2);
  },
  setMusic(level, muffled) {
    if (!ctx) return;
    musicGain.gain.setTargetAtTime(level, ctx.currentTime, 0.15);
    musicLP.frequency.setTargetAtTime(muffled ? 650 : 16000, ctx.currentTime, 0.2);
  },
  siren(on, level = 0.16) { if (ctx) sirenGain.gain.setTargetAtTime(on ? level : 0, ctx.currentTime, 0.05); },
  setMaster(v) { if (ctx) master.gain.value = v; },
  sfx(name) {
    if (!ctx) return; const t = ctx.currentTime, m = master;
    switch (name) {
      case 'click': noise(t, 0.02, 0.25, m, 'bandpass', 2500); tone('square', 1800, t, 0.001, 0.02, 0.05, m); break;
      case 'tap': tone('sine', 1200, t, 0.002, 0.05, 0.08, m); break;
      case 'beep': tone('sine', 1560, t, 0.004, 0.09, 0.12, m); break;
      case 'ok': tone('sine', 1320, t, 0.004, 0.1, 0.14, m); tone('sine', 1760, t + 0.11, 0.004, 0.18, 0.14, m); break;
      case 'fail': tone('square', 220, t, 0.004, 0.14, 0.1, m, 900); tone('square', 196, t + 0.17, 0.004, 0.22, 0.1, m, 900); break;
      case 'motor': noise(t, 0.55, 0.12, m, 'bandpass', 420); tone('sawtooth', 95, t, 0.03, 0.5, 0.05, m, 400); break;
      case 'hum': noise(t, 1.6, 0.035, m, 'bandpass', 300); break;
      case 'bell': tone('sine', 988, t, 0.004, 0.7, 0.22, m); tone('sine', 784, t + 0.45, 0.004, 1.0, 0.22, m); break;
      case 'chime': tone('sine', 1046, t, 0.004, 0.25, 0.1, m); tone('sine', 1568, t + 0.09, 0.004, 0.35, 0.08, m); break;
      case 'scene': tone('sine', 660, t, 0.01, 0.2, 0.08, m); tone('sine', 880, t + 0.08, 0.01, 0.2, 0.08, m); tone('sine', 1320, t + 0.16, 0.01, 0.4, 0.08, m); break;
      case 'door': noise(t, 0.18, 0.2, m, 'lowpass', 300); tone('sine', 70, t, 0.004, 0.15, 0.25, m); break;
      case 'count': tone('sine', 880, t, 0.004, 0.06, 0.08, m); break;
      case 'ir': tone('sine', 2400, t, 0.002, 0.03, 0.04, m); break;
    }
  },
  say(text) {
    if (!this.voice || !this.ready || !('speechSynthesis' in window)) return;
    try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.rate = 1; u.pitch = 1.05; u.volume = 0.9; speechSynthesis.speak(u); } catch (e) { /* voice is optional */ }
  },
};
