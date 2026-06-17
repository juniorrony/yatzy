// ─── WEB AUDIO CONTEXT ────────────────────────────────────────────────────────
let _ctx = null;
let _muted = localStorage.getItem('yatzy_muted') === 'true';

function ctx() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
  // Resume if suspended (browser autoplay policy)
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

export function isMuted() { return _muted; }

export function toggleMute() {
  _muted = !_muted;
  localStorage.setItem('yatzy_muted', _muted);
  return _muted;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function noise(duration = 0.08, vol = 0.15) {
  if (_muted) return;
  const c      = ctx();
  const buffer = c.createBuffer(1, c.sampleRate * duration, c.sampleRate);
  const data   = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src    = c.createBufferSource();
  src.buffer   = buffer;
  const gain   = c.createGain();
  gain.gain.setValueAtTime(vol, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
  const filter = c.createBiquadFilter();
  filter.type  = 'bandpass';
  filter.frequency.value = 800;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(c.destination);
  src.start();
}

function tone(freq, duration = 0.12, vol = 0.18, type = 'sine', delay = 0) {
  if (_muted) return;
  const c    = ctx();
  const osc  = c.createOscillator();
  const gain = c.createGain();
  osc.type   = type;
  osc.frequency.setValueAtTime(freq, c.currentTime + delay);
  gain.gain.setValueAtTime(0.001, c.currentTime + delay);
  gain.gain.linearRampToValueAtTime(vol, c.currentTime + delay + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + duration);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(c.currentTime + delay);
  osc.stop(c.currentTime + delay + duration + 0.05);
}

// ─── SOUND EFFECTS ────────────────────────────────────────────────────────────
export function playRoll() {
  // Short burst of noise = dice rattling
  noise(0.06, 0.2);
  setTimeout(() => noise(0.05, 0.15), 80);
  setTimeout(() => noise(0.07, 0.18), 180);
  setTimeout(() => noise(0.04, 0.12), 300);
}

export function playHold() {
  tone(440, 0.08, 0.1, 'sine');
}

export function playScore() {
  tone(523, 0.1,  0.12, 'sine');
  tone(659, 0.1,  0.10, 'sine', 0.08);
}

export function playZero() {
  tone(220, 0.15, 0.1, 'sawtooth');
  tone(196, 0.2,  0.08,'sawtooth', 0.1);
}

export function playBonus() {
  // Rising arpeggio for upper bonus earned
  [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.15, 0.12, 'sine', i * 0.08));
}

export function playYatzy() {
  // Fanfare
  const notes = [523, 659, 784, 1047, 784, 1047, 1319];
  const times = [0, 0.1, 0.2, 0.3, 0.45, 0.55, 0.65];
  notes.forEach((f, i) => tone(f, 0.18, 0.18, 'sine', times[i]));
}

export function playUndo() {
  tone(330, 0.1, 0.1, 'sine');
  tone(262, 0.1, 0.1, 'sine', 0.09);
}

export function playTimerWarn() {
  tone(880, 0.06, 0.08, 'square');
}
